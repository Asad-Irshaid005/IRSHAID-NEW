const SUPABASE_URL = "https://abxqvtyxajowcfnvuhxh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1boGmE46lsyeK8PKchtwag_7McdsKAU";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let allProducts = [];
let currentCategory = "All";
let searchTerm = "";
let sortOrder = "default";

function renderProducts(list) {
    const container = document.getElementById("product-list");
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = "<p>No products found.</p>";
        return;
    }
    container.innerHTML = list.map(prod => {
        const productId = prod.product_id;
        return `
            <div class="product">
                <h3>${escapeHtml(prod.name)}</h3>
                <p>AED ${prod.price}</p>
                <p>Stock: ${prod.stock}</p>
                <button onclick='addToCart(${JSON.stringify(prod)})'>
                    Add to Cart
                </button>
                <br><br>
                <a href="product-detail.html?id=${productId}">
                    View Details
                </a>
            </div>
        `;
    }).join("");
}

function updateProductView() {
    let filtered = [...allProducts];
    if (currentCategory !== "All") {
        filtered = filtered.filter(p => p.category?.category_name === currentCategory);
    }
    if (searchTerm) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
    }
    if (sortOrder === "low-high") {
        filtered.sort((a, b) => Number(a.price) - Number(b.price));
    }
    if (sortOrder === "high-low") {
        filtered.sort((a, b) => Number(b.price) - Number(a.price));
    }
    renderProducts(filtered);
}

async function loadProducts() {
    const container = document.getElementById("product-list");
    if (!container) return;
    container.innerHTML = "<p>Loading products...</p>";
    
    const { data, error } = await supabaseClient
        .from("product")
        .select("*, category(category_name)");
        
    if (error) {
        console.error("Supabase Error:", error);
        container.innerHTML = `<p>Could not load products: ${error.message}</p>`;
        return;
    }
    allProducts = data || [];
    updateProductView();
}

const searchBox = document.getElementById("search-box");
if (searchBox) {
    searchBox.addEventListener("input", e => {
        searchTerm = e.target.value.toLowerCase();
        updateProductView();
    });
}

document.querySelectorAll(".category-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        currentCategory = btn.dataset.category;
        updateProductView();
    });
});

const sortSelect = document.getElementById("sort-select");
if (sortSelect) {
    sortSelect.addEventListener("change", e => {
        sortOrder = e.target.value;
        updateProductView();
    });
}

if (document.getElementById("product-list")) {
    loadProducts();
}

// ---------------------------------------------------------------------
// Lab 9: smart product search (keyword scoring, no AI)
// ---------------------------------------------------------------------
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function scoreProduct(product, queryWords) {
    const text = `${product.name} ${product.description || ""} ${product.category?.category_name || ""}`.toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
        if (text.includes(word)) score += 1;
    });
    return score;
}

function extractMaxPrice(query) {
    const match = query.match(/(?:under|below)\s+(\d+)/i);
    if (!match) return null;
    return Number(match[1]);
}

function smartSearch(query, products) {
    const maxPrice = extractMaxPrice(query);
    const candidates = maxPrice
        ? products.filter(p => Number(p.price) <= maxPrice)
        : products;

    // Remove the "under 500" part, drop short filler words, trim plurals
    const queryWords = query
        .toLowerCase()
        .replace(/(?:under|below)\s+\d+/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2)
        .map(w => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

    // Only a price rule and no words: show the cheapest matches
    if (queryWords.length === 0) {
        return maxPrice
            ? [...candidates].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 6)
            : [];
    }

    return candidates
        .map(p => ({ product: p, score: scoreProduct(p, queryWords) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(r => r.product);
}

const smartSearchBox = document.getElementById("smart-search");
if (smartSearchBox) {
    smartSearchBox.addEventListener("input", async e => {
        const query = e.target.value.trim();
        const resultsDiv = document.getElementById("smart-results");
        if (query.length < 3) {
            resultsDiv.innerHTML = "";
            return;
        }
        if (allProducts.length === 0) {
            const { data } = await supabaseClient
                .from("product")
                .select("*, category(category_name)");
            allProducts = data || [];
        }
        const matches = smartSearch(query, allProducts);
        resultsDiv.innerHTML = matches.length
            ? matches.map(p => `
                <p><a href="product-detail.html?id=${p.product_id}">${escapeHtml(p.name)}</a>
                &mdash; AED ${Number(p.price).toFixed(2)}
                <small>(${escapeHtml(p.category?.category_name || "")})</small></p>
            `).join("")
            : "<p>No matches. Try different words.</p>";
    });
}

function getCart() {
    return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
    localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(product) {
    const cart = getCart();
    const productId = product.product_id;
    const existing = cart.find(item => Number(item.product_id) === Number(productId));
    
    if (existing) {
        existing.quantity = Number(existing.quantity) + 1;
    } else {
        cart.push({
            ...product,
            product_id: productId,
            price: Number(product.price),
            quantity: 1
        });
    }
    saveCart(cart);
    alert("Product added to cart!");
}

function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(p => Number(p.product_id) !== Number(productId));
    saveCart(cart);
}

function updateQuantity(productId, quantity) {
    const cart = getCart();
    const item = cart.find(p => Number(p.product_id) === Number(productId));
    if (!item) return;
    const newQty = parseInt(quantity);
    if (isNaN(newQty) || newQty < 1) return;
    item.quantity = newQty;
    saveCart(cart);
}

function renderCart() {
    const cart = getCart();
    const container = document.getElementById("cart-items");
    if (!container) return;
    
    if (cart.length === 0) {
        container.innerHTML = "<p>Your cart is empty.</p>";
        const subtotalEl = document.getElementById("subtotal");
        if (subtotalEl) subtotalEl.textContent = "0.00";
        return;
    }
    
    let subtotal = 0;
    container.innerHTML = cart.map(item => {
        const price = Number(item.price);
        const qty = Number(item.quantity);
        const lineTotal = price * qty;
        subtotal += lineTotal;
        
        return `
            <div class="cart-item">
                <span>${escapeHtml(item.name)}</span>
                <input type="number" min="1" value="${qty}" onchange="updateQuantity(${item.product_id}, this.value); renderCart();">
                <span>AED ${lineTotal.toFixed(2)}</span>
                <button onclick="removeFromCart(${item.product_id}); renderCart();">Remove</button>
            </div>
        `;
    }).join("");
    
    const subtotalEl = document.getElementById("subtotal");
    if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2);
}

if (document.getElementById("cart-items")) {
    renderCart();
}

function goToCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
    }
    window.location.href = "checkout.html";
}

const registerForm = document.getElementById("register-form");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            alert("Registration Error: " + error.message);
            return;
        }
        alert("Registration successful! You can now log in.");
        window.location.href = "login.html";
    });
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            alert(error.message);
        } else {
            window.location.href = "index.html";
        }
    });
}

async function updateNavForAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const navSlot = document.getElementById("auth-nav-slot");
    if (!navSlot) return;
    if (user) {
        navSlot.innerHTML = `<span>Hi, ${escapeHtml(user.email)}</span> <a href="#" id="logout-link" onclick="logout(); return false;">Log out</a>`;
    } else {
        navSlot.innerHTML = '<a href="login.html">Login</a>';
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

async function requireLogin() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
        window.location.href = "login.html";
        return null;
    }
    return user;
}

updateNavForAuth();