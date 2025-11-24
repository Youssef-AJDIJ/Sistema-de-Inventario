/**
 * products.js - Gestión de productos
 */

/**
 * Cargar productos
 */
async function loadProducts(search = '') {
    try {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const products = await fetchAPI('products.php' + query);
        state.products = products;
        displayProducts(products);
    } catch (error) {
        showNotification('Error al cargar productos', 'danger');
        console.error(error);
    }
}

function displayProducts(products) {
    const tbody = document.getElementById('productsTable');

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay productos</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.id}</td>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category || 'Sin categoría')}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>
                ${product.quantity !== null && product.quantity !== undefined
            ? (product.quantity < product.min_stock
                ? `<span class="badge badge-warning">${product.quantity}</span>`
                : product.quantity)
            : 'N/A'}
            </td>
            <td>
                <button class="btn btn-primary" onclick="editProduct(${product.id})" 
                        style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    ✏️ Editar
                </button>
                <button class="btn btn-danger" onclick="deleteProduct(${product.id})" 
                        style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    🗑️ Eliminar
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Búsqueda de productos
 */
function searchProducts() {
    const search = document.getElementById('productSearch').value;
    loadProducts(search);
}

/**
 * Abrir modal de producto
 */
function openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    form.reset();
    document.getElementById('productId').value = '';

    if (productId) {
        title.textContent = 'Editar Producto';
        loadProductData(productId);
    } else {
        title.textContent = 'Nuevo Producto';
    }

    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

/**
 * Cargar datos de producto para edición
 */
async function loadProductData(productId) {
    try {
        const product = await fetchAPI(`products.php?id=${productId}`);

        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('productQuantity').value = product.quantity || 0;
        document.getElementById('productMinStock').value = product.min_stock || 10;
    } catch (error) {
        showNotification('Error al cargar el producto', 'danger');
        console.error(error);
    }
}

/**
 * Guardar producto
 */
async function saveProduct(event) {
    event.preventDefault();

    const id = document.getElementById('productId').value;
    const data = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        price: parseFloat(document.getElementById('productPrice').value),
        category: document.getElementById('productCategory').value,
        quantity: parseInt(document.getElementById('productQuantity').value) || 0,
        min_stock: parseInt(document.getElementById('productMinStock').value) || 10
    };

    try {
        if (id) {
            // Actualizar producto existente
            data.id = id;
            await fetchAPI('products.php', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showNotification('Producto actualizado exitosamente', 'success');
        } else {
            // Crear nuevo producto
            await fetchAPI('products.php', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showNotification('Producto creado exitosamente', 'success');
        }

        closeProductModal();
        loadProducts();

        // Si estamos en el dashboard, recargar
        if (state.currentTab === 'dashboard') {
            loadDashboard();
        }
    } catch (error) {
        showNotification('Error al guardar el producto', 'danger');
        console.error(error);
    }
}

/**
 * Editar producto
 */
function editProduct(productId) {
    openProductModal(productId);
}

/**
 * Eliminar producto
 */
async function deleteProduct(productId) {
    if (!confirmAction('¿Estás seguro de eliminar este producto?')) {
        return;
    }

    try {
        await fetchAPI('products.php', {
            method: 'DELETE',
            body: JSON.stringify({ id: productId })
        });

        showNotification('Producto eliminado exitosamente', 'success');
        loadProducts();

        // Si estamos en el dashboard, recargar
        if (state.currentTab === 'dashboard') {
            loadDashboard();
        }
    } catch (error) {
        showNotification('Error al eliminar el producto', 'danger');
        console.error(error);
    }
}
