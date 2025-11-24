/**
 * customers.js - Gestión de clientes
 */

/**
 * Cargar clientes
 */
async function loadCustomers(search = '') {
    try {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const customers = await fetchAPI('customers.php' + query);
        state.customers = customers;
        displayCustomers(customers);
    } catch (error) {
        showNotification('Error al cargar clientes', 'danger');
        console.error(error);
    }
}

function displayCustomers(customers) {
    const tbody = document.getElementById('customersTable');

    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay clientes</td></tr>';
        return;
    }

    tbody.innerHTML = customers.map(customer => `
        <tr>
            <td>${customer.id}</td>
            <td>${escapeHtml(customer.name)}</td>
            <td>${escapeHtml(customer.email || '')}</td>
            <td>${escapeHtml(customer.phone || '')}</td>
            <td>${escapeHtml(customer.tax_id || '')}</td>
            <td>
                <button class="btn btn-primary" onclick="editCustomer(${customer.id})" 
                        style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    ✏️ Editar
                </button>
                <button class="btn btn-danger" onclick="deleteCustomer(${customer.id})" 
                        style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    🗑️ Eliminar
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Búsqueda de clientes
 */
function searchCustomers() {
    const search = document.getElementById('customerSearch').value;
    loadCustomers(search);
}

/**
 * Abrir modal de cliente
 */
function openCustomerModal(customerId = null) {
    const modal = document.getElementById('customerModal');
    const title = document.getElementById('customerModalTitle');
    const form = document.getElementById('customerForm');

    form.reset();
    document.getElementById('customerId').value = '';

    if (customerId) {
        title.textContent = 'Editar Cliente';
        loadCustomerData(customerId);
    } else {
        title.textContent = 'Nuevo Cliente';
    }

    modal.classList.add('active');
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.remove('active');
}

/**
 * Cargar datos de cliente para edición
 */
async function loadCustomerData(customerId) {
    try {
        const customer = await fetchAPI(`customers.php?id=${customerId}`);

        document.getElementById('customerId').value = customer.id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerEmail').value = customer.email || '';
        document.getElementById('customerPhone').value = customer.phone || '';
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerTaxId').value = customer.tax_id || '';
    } catch (error) {
        showNotification('Error al cargar el cliente', 'danger');
        console.error(error);
    }
}

/**
 * Guardar cliente
 */
async function saveCustomer(event) {
    event.preventDefault();

    const id = document.getElementById('customerId').value;
    const data = {
        name: document.getElementById('customerName').value,
        email: document.getElementById('customerEmail').value,
        phone: document.getElementById('customerPhone').value,
        address: document.getElementById('customerAddress').value,
        tax_id: document.getElementById('customerTaxId').value
    };

    try {
        if (id) {
            // Actualizar cliente existente
            data.id = id;
            await fetchAPI('customers.php', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showNotification('Cliente actualizado exitosamente', 'success');
        } else {
            // Crear nuevo cliente
            await fetchAPI('customers.php', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showNotification('Cliente creado exitosamente', 'success');
        }

        closeCustomerModal();
        loadCustomers();
    } catch (error) {
        showNotification('Error al guardar el cliente', 'danger');
        console.error(error);
    }
}

/**
 * Editar cliente
 */
function editCustomer(customerId) {
    openCustomerModal(customerId);
}

/**
 * Eliminar cliente
 */
async function deleteCustomer(customerId) {
    if (!confirmAction('¿Estás seguro de eliminar este cliente?')) {
        return;
    }

    try {
        await fetchAPI('customers.php', {
            method: 'DELETE',
            body: JSON.stringify({ id: customerId })
        });

        showNotification('Cliente eliminado exitosamente', 'success');
        loadCustomers();
    } catch (error) {
        if (error.message.includes('409')) {
            showNotification('No se puede eliminar el cliente porque tiene facturas asociadas', 'warning');
        } else {
            showNotification('Error al eliminar el cliente', 'danger');
        }
        console.error(error);
    }
}
