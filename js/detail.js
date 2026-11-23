const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

async function loadProduct() {
    const detail = document.getElementById("detail");
    if (!detail) {
        console.error("Element with id='detail' was not found");
        return;
    }
    
    if (!productId) {
        detail.innerHTML = "<p>Product ID is missing from URL.</p>";
        return;
    }
    
    // Query product directly without table joins to prevent errors
    const { data, error } = await supabaseClient
        .from("product")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
        
    if (error) {
        console.error("Supabase error:", error);
        detail.innerHTML = `<p>Error loading product details: ${error.message}</p>`;
        return;
    }
    
    if (!data) {
        detail.innerHTML = "<p>Product not found.</p>";
        return;
    }
    
    detail.innerHTML = `
        <h2>${escapeHtml(data.name)}</h2>
        <p>${escapeHtml(data.description ?? "No description available.")}</p>
        <p><strong>Price:</strong> AED ${data.price}</p>
        <p><strong>Stock:</strong> ${data.stock}</p>
        <br>
        <button onclick='addToCart(${JSON.stringify(data)})'>Add to Cart</button>
    `;
}

loadProduct();