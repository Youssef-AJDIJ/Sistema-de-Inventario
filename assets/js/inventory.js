/**
 * inventory.js - Gestión de inventario
 */

/**
 * Cargar inventario
 */
async function loadInventory() {
    try {
        const inventory = await fetchAPI('inventory.php');
        displayInventory(inventory);
    } catch (error) {
        showNotification('Error al cargar inventario', 'danger');
        console.error(error);
    }
}

function displayInventory(inventory) {
    const tbody = document.getElementById('inventoryTable');

    if (!inventory || inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay productos en inventario</td></tr>';
        return;
    }

    tbody.innerHTML = inventory.map(item => {
        let statusBadge = '';
        switch (item.status) {
            case 'sin_stock':
                statusBadge = '<span class="badge badge-danger">Sin Stock</span>';
                break;
            case 'stock_bajo':
                statusBadge = '<span class="badge badge-warning">Stock Bajo</span>';
                break;
            default:
                statusBadge = '<span class="badge badge-success">OK</span>';
        }

        return `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.category || 'Sin categoría')}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${item.quantity !== null ? item.quantity : 'N/A'}</td>
                <td>${item.min_stock !== null ? item.min_stock : 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>${item.last_updated ? formatDate(item.last_updated) : 'N/A'}</td>
                <td>
                    <button class="btn btn-success" onclick="updateInventory(${item.id}, '${escapeHtml(item.name)}', ${item.quantity}, ${item.min_stock})" 
                            style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                        ✏️ Actualizar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Abrir modal de actualización de inventario
 */
function updateInventory(productId, productName, quantity, minStock) {
    document.getElementById('inventoryProductId').value = productId;
    document.getElementById('inventoryProductName').value = productName;
    document.getElementById('inventoryQuantity').value = quantity;
    document.getElementById('inventoryMinStock').value = minStock;

    document.getElementById('inventoryModal').classList.add('active');
}

function closeInventoryModal() {
    document.getElementById('inventoryModal').classList.remove('active');
}

/**
 * Guardar cambios de inventario
 */
async function saveInventory(event) {
    event.preventDefault();

    const data = {
        product_id: parseInt(document.getElementById('inventoryProductId').value),
        quantity: parseInt(document.getElementById('inventoryQuantity').value),
        min_stock: parseInt(document.getElementById('inventoryMinStock').value)
    };

    try {
        await fetchAPI('inventory.php', {
            method: 'PUT',
            body: JSON.stringify(data)
        });

        showNotification('Inventario actualizado exitosamente', 'success');
        closeInventoryModal();
        loadInventory();

        // Si estamos en el dashboard, recargar
        if (state.currentTab === 'dashboard') {
            loadDashboard();
        }
    } catch (error) {
        showNotification('Error al actualizar inventario', 'danger');
        console.error(error);
    }
}
