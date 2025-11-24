/**
 * invoices.js - Gestión de facturas
 */

let invoiceItemCount = 0;

/**
 * Cargar facturas
 */
async function loadInvoices() {
    try {
        const invoices = await fetchAPI('invoices.php');
        state.invoices = invoices;
        displayInvoices(invoices);
    } catch (error) {
        showNotification('Error al cargar facturas', 'danger');
        console.error(error);
    }
}

function displayInvoices(invoices) {
    const tbody = document.getElementById('invoicesTable');

    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay facturas</td></tr>';
        return;
    }

    tbody.innerHTML = invoices.map(invoice => {
        let statusBadge = '';
        switch (invoice.status) {
            case 'pendiente':
                statusBadge = '<span class="badge badge-warning">Pendiente</span>';
                break;
            case 'pagada':
                statusBadge = '<span class="badge badge-success">Pagada</span>';
                break;
            case 'cancelada':
                statusBadge = '<span class="badge badge-danger">Cancelada</span>';
                break;
        }

        return `
            <tr>
                <td>${escapeHtml(invoice.invoice_number)}</td>
                <td>${escapeHtml(invoice.customer_name)}</td>
                <td>${formatDate(invoice.invoice_date)}</td>
                <td>${formatCurrency(invoice.total)}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-primary" onclick="viewInvoice(${invoice.id})" 
                            style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                        👁️ Ver
                    </button>
                    <button class="btn btn-success" onclick="updateInvoiceStatus(${invoice.id}, '${invoice.status}')" 
                            style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                        ✏️ Estado
                    </button>
                    <button class="btn btn-danger" onclick="deleteInvoice(${invoice.id})" 
                            style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                        🗑️ Eliminar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Filtrar facturas por estado
 */
function filterInvoices() {
    const status = document.getElementById('statusFilter').value;
    const query = status ? `?status=${status}` : '';

    fetchAPI('invoices.php' + query)
        .then(invoices => {
            displayInvoices(invoices);
        })
        .catch(error => {
            showNotification('Error al filtrar facturas', 'danger');
            console.error(error);
        });
}

/**
 * Abrir modal de nueva factura
 */
async function openInvoiceModal() {
    // Cargar clientes y productos
    try {
        const customers = await fetchAPI('customers.php');
        const products = await fetchAPI('products.php');

        state.customers = customers;
        state.products = products;

        // Poblar select de clientes
        const customerSelect = document.getElementById('invoiceCustomer');
        customerSelect.innerHTML = '<option value="">Seleccionar cliente...</option>' +
            customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

        // Limpiar formulario
        document.getElementById('invoiceForm').reset();
        document.getElementById('invoiceItems').innerHTML = '';
        document.getElementById('invoiceTotal').textContent = '0.00';
        invoiceItemCount = 0;

        // Agregar primer item
        addInvoiceItem();

        document.getElementById('invoiceModal').classList.add('active');
    } catch (error) {
        showNotification('Error al abrir el modal de factura', 'danger');
        console.error(error);
    }
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').classList.remove('active');
}

/**
 * Agregar item a la factura
 */
function addInvoiceItem() {
    const container = document.getElementById('invoiceItems');
    const itemId = invoiceItemCount++;

    const productsOptions = state.products.map(p =>
        `<option value="${p.id}" data-price="${p.price}">${escapeHtml(p.name)} - ${formatCurrency(p.price)}</option>`
    ).join('');

    const itemHTML = `
        <div class="card mt-1" id="invoice-item-${itemId}" style="padding: 1rem; background: var(--bg-tertiary);">
            <div class="flex flex-between mb-1">
                <h4>Producto ${itemId + 1}</h4>
                <button type="button" class="btn btn-danger" onclick="removeInvoiceItem(${itemId})" 
                        style="padding: 0.5rem 1rem;">
                    ✕ Quitar
                </button>
            </div>
            
            <div class="form-group">
                <label class="form-label">Producto *</label>
                <select class="form-select invoice-product" data-item="${itemId}" 
                        onchange="updateItemPrice(${itemId})" required>
                    <option value="">Seleccionar producto...</option>
                    ${productsOptions}
                </select>
            </div>
            
            <div class="flex flex-gap">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Cantidad *</label>
                    <input type="number" class="form-input invoice-quantity" data-item="${itemId}" 
                           min="1" value="1" onchange="calculateInvoiceTotal()" required>
                </div>
                
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Precio Unitario *</label>
                    <input type="number" step="0.01" class="form-input invoice-price" 
                           data-item="${itemId}" min="0" value="0" onchange="calculateInvoiceTotal()" required>
                </div>
                
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Subtotal</label>
                    <input type="text" class="form-input invoice-subtotal" data-item="${itemId}" 
                           readonly value="0.00 €">
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHTML);
}

/**
 * Quitar item de la factura
 */
function removeInvoiceItem(itemId) {
    const item = document.getElementById(`invoice-item-${itemId}`);
    if (item) {
        item.remove();
        calculateInvoiceTotal();
    }
}

/**
 * Actualizar precio al seleccionar producto
 */
function updateItemPrice(itemId) {
    const select = document.querySelector(`.invoice-product[data-item="${itemId}"]`);
    const priceInput = document.querySelector(`.invoice-price[data-item="${itemId}"]`);

    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        const price = selectedOption.getAttribute('data-price');
        priceInput.value = price;
        calculateInvoiceTotal();
    }
}

/**
 * Calcular total de la factura
 */
function calculateInvoiceTotal() {
    let total = 0;

    document.querySelectorAll('.invoice-product').forEach((select, index) => {
        if (select.value) {
            const itemId = select.getAttribute('data-item');
            const quantity = parseFloat(document.querySelector(`.invoice-quantity[data-item="${itemId}"]`).value) || 0;
            const price = parseFloat(document.querySelector(`.invoice-price[data-item="${itemId}"]`).value) || 0;
            const subtotal = quantity * price;

            document.querySelector(`.invoice-subtotal[data-item="${itemId}"]`).value = formatCurrency(subtotal);
            total += subtotal;
        }
    });

    document.getElementById('invoiceTotal').textContent = formatCurrency(total);
}

/**
 * Guardar factura
 */
async function saveInvoice(event) {
    event.preventDefault();

    const items = [];
    let hasError = false;

    document.querySelectorAll('.invoice-product').forEach(select => {
        const itemId = select.getAttribute('data-item');
        const productId = parseInt(select.value);
        const quantity = parseInt(document.querySelector(`.invoice-quantity[data-item="${itemId}"]`).value);
        const price = parseFloat(document.querySelector(`.invoice-price[data-item="${itemId}"]`).value);

        if (productId && quantity && price) {
            items.push({
                product_id: productId,
                quantity: quantity,
                unit_price: price
            });
        } else if (select.value || quantity || price) {
            hasError = true;
        }
    });

    if (items.length === 0) {
        showNotification('Debes agregar al menos un producto', 'warning');
        return;
    }

    if (hasError) {
        showNotification('Completa todos los campos de los productos', 'warning');
        return;
    }

    const data = {
        customer_id: parseInt(document.getElementById('invoiceCustomer').value),
        invoice_date: document.getElementById('invoiceDate').value,
        notes: document.getElementById('invoiceNotes').value,
        items: items
    };

    try {
        const result = await fetchAPI('invoices.php', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showNotification(`Factura ${result.invoice_number} creada exitosamente`, 'success');
        closeInvoiceModal();
        loadInvoices();

        // Si estamos en el dashboard, recargar
        if (state.currentTab === 'dashboard') {
            loadDashboard();
        }
    } catch (error) {
        showNotification('Error al crear la factura', 'danger');
        console.error(error);
    }
}

/**
 * Ver detalles de factura
 */
async function viewInvoice(invoiceId) {
    try {
        const invoice = await fetchAPI(`invoices.php?id=${invoiceId}`);
        displayInvoiceDetails(invoice);
        document.getElementById('viewInvoiceModal').classList.add('active');
    } catch (error) {
        showNotification('Error al cargar la factura', 'danger');
        console.error(error);
    }
}

function displayInvoiceDetails(invoice) {
    const content = document.getElementById('invoiceContent');

    let statusBadge = '';
    switch (invoice.status) {
        case 'pendiente':
            statusBadge = '<span class="badge badge-warning">Pendiente</span>';
            break;
        case 'pagada':
            statusBadge = '<span class="badge badge-success">Pagada</span>';
            break;
        case 'cancelada':
            statusBadge = '<span class="badge badge-danger">Cancelada</span>';
            break;
    }

    const itemsHTML = invoice.items.map(item => `
        <tr>
            <td>${escapeHtml(item.product_name)}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unit_price)}</td>
            <td class="text-right">${formatCurrency(item.subtotal)}</td>
        </tr>
    `).join('');

    content.innerHTML = `
        <div style="border: 2px solid var(--border-color); padding: 2rem; background: var(--bg-secondary);">
            <div class="flex flex-between" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid var(--primary-color);">
                <div>
                    <h1 style="margin: 0; color: var(--primary-color);">FACTURA</h1>
                    <p style="margin: 0.5rem 0; font-size: 1.2rem; font-weight: bold;">${escapeHtml(invoice.invoice_number)}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0;"><strong>Fecha:</strong> ${formatDate(invoice.invoice_date)}</p>
                    <p style="margin: 0.5rem 0;"><strong>Estado:</strong> ${statusBadge}</p>
                </div>
            </div>
            
            <div class="flex flex-between" style="margin-bottom: 2rem;">
                <div>
                    <h3 style="margin-bottom: 0.5rem;">Cliente</h3>
                    <p style="margin: 0; font-size: 1.1rem; font-weight: bold;">${escapeHtml(invoice.customer_name)}</p>
                    ${invoice.email ? `<p style="margin: 0.25rem 0;">Email: ${escapeHtml(invoice.email)}</p>` : ''}
                    ${invoice.phone ? `<p style="margin: 0.25rem 0;">Teléfono: ${escapeHtml(invoice.phone)}</p>` : ''}
                    ${invoice.address ? `<p style="margin: 0.25rem 0;">Dirección: ${escapeHtml(invoice.address)}</p>` : ''}
                    ${invoice.customer_tax_id ? `<p style="margin: 0.25rem 0;">NIF/CIF: ${escapeHtml(invoice.customer_tax_id)}</p>` : ''}
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 2rem 0;">
                <thead>
                    <tr style="background: var(--bg-tertiary);">
                        <th style="padding: 1rem; text-align: left; border: 1px solid var(--border-color);">Producto</th>
                        <th style="padding: 1rem; text-align: center; border: 1px solid var(--border-color);">Cantidad</th>
                        <th style="padding: 1rem; text-align: right; border: 1px solid var(--border-color);">Precio Unit.</th>
                        <th style="padding: 1rem; text-align: right; border: 1px solid var(--border-color);">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="padding: 1rem; text-align: right; border: 1px solid var(--border-color); font-weight: bold; font-size: 1.2rem;">
                            TOTAL:
                        </td>
                        <td style="padding: 1rem; text-align: right; border: 1px solid var(--border-color); font-weight: bold; font-size: 1.2rem; color: var(--primary-color);">
                            ${formatCurrency(invoice.total)}
                        </td>
                    </tr>
                </tfoot>
            </table>
            
            ${invoice.notes ? `
                <div style="margin-top: 2rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                    <strong>Notas:</strong><br>
                    ${escapeHtml(invoice.notes)}
                </div>
            ` : ''}
        </div>
    `;
}

function closeViewInvoiceModal() {
    document.getElementById('viewInvoiceModal').classList.remove('active');
}

/**
 * Actualizar estado de factura
 */
async function updateInvoiceStatus(invoiceId, currentStatus) {
    const newStatus = prompt('Nuevo estado (pendiente/pagada/cancelada):', currentStatus);

    if (!newStatus || !['pendiente', 'pagada', 'cancelada'].includes(newStatus)) {
        if (newStatus !== null) {
            showNotification('Estado inválido', 'warning');
        }
        return;
    }

    try {
        await fetchAPI('invoices.php', {
            method: 'PUT',
            body: JSON.stringify({
                id: invoiceId,
                status: newStatus
            })
        });

        showNotification('Estado actualizado exitosamente', 'success');
        loadInvoices();

        // Si estamos en el dashboard, recargar
        if (state.currentTab === 'dashboard') {
            loadDashboard();
        }
    } catch (error) {
        showNotification('Error al actualizar el estado', 'danger');
        console.error(error);
    }
}

/**
 * Eliminar factura
 */
async function deleteInvoice(invoiceId) {
    if (!confirmAction('¿Estás seguro de eliminar esta factura? El inventario se restaurará.')) {
        return;
    }

    try {
        await fetchAPI('invoices.php', {
            method: 'DELETE',
            body: JSON.stringify({ id: invoiceId })
        });

        showNotification('Factura eliminada exitosamente', 'success');
        loadInvoices();

        // Si estamos en el dashboard, recargar
        if (state.currentTab === 'dashboard') {
            loadDashboard();
        }
    } catch (error) {
        showNotification('Error al eliminar la factura', 'danger');
        console.error(error);
    }
}
