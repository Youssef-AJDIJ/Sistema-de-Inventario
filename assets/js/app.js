/**
 * App.js - Funcionalidad central de la aplicación
 */

// Configuración de la API
const API_BASE = 'api/';

// Estado global
const state = {
    products: [],
    customers: [],
    invoices: [],
    currentTab: 'dashboard'
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadDashboard();
});

/**
 * Navegación entre pestañas
 */
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    // Actualizar botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('active');
    });
    
    const activeTab = document.getElementById(tabName);
    activeTab.classList.remove('hidden');
    activeTab.classList.add('active');
    
    state.currentTab = tabName;
    
    // Cargar datos según la pestaña
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'products':
            loadProducts();
            break;
        case 'inventory':
            loadInventory();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'invoices':
            loadInvoices();
            break;
    }
}

/**
 * Cargar Dashboard
 */
async function loadDashboard() {
    try {
        // Cargar estadísticas de inventario
        const inventoryStats = await fetchAPI('inventory.php?stats=1');
        
        // Cargar estadísticas de facturas
        const invoiceStats = await fetchAPI('invoices.php?stats=1');
        
        // Mostrar estadísticas
        displayStats(inventoryStats, invoiceStats);
        
        // Cargar productos con stock bajo
        const lowStock = await fetchAPI('inventory.php?low_stock=1');
        displayLowStock(lowStock);
        
    } catch (error) {
        showNotification('Error al cargar el dashboard', 'danger');
        console.error(error);
    }
}

function displayStats(inventoryStats, invoiceStats) {
    const statsGrid = document.getElementById('statsGrid');
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Total Productos</div>
            <div class="stat-value">${inventoryStats.total_products || 0}</div>
        </div>
        
        <div class="stat-card success">
            <div class="stat-label">Items en Stock</div>
            <div class="stat-value">${inventoryStats.total_items || 0}</div>
        </div>
        
        <div class="stat-card warning">
            <div class="stat-label">Stock Bajo</div>
            <div class="stat-value">${inventoryStats.low_stock_count || 0}</div>
        </div>
        
        <div class="stat-card danger">
            <div class="stat-label">Sin Stock</div>
            <div class="stat-value">${inventoryStats.out_of_stock_count || 0}</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-label">Total Facturas</div>
            <div class="stat-value">${invoiceStats.total_invoices || 0}</div>
        </div>
        
        <div class="stat-card success">
            <div class="stat-label">Ingresos Totales</div>
            <div class="stat-value">${formatCurrency(invoiceStats.total_revenue || 0)}</div>
        </div>
        
        <div class="stat-card warning">
            <div class="stat-label">Pendiente de Cobro</div>
            <div class="stat-value">${formatCurrency(invoiceStats.pending_amount || 0)}</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-label">Ticket Promedio</div>
            <div class="stat-value">${formatCurrency(invoiceStats.average_invoice || 0)}</div>
        </div>
    `;
}

function displayLowStock(products) {
    const tbody = document.getElementById('lowStockTable');
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay productos con stock bajo</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category || 'Sin categoría')}</td>
            <td>${product.quantity}</td>
            <td>${product.min_stock}</td>
            <td>
                ${product.quantity === 0 
                    ? '<span class="badge badge-danger">Sin Stock</span>' 
                    : '<span class="badge badge-warning">Stock Bajo</span>'}
            </td>
        </tr>
    `).join('');
}

/**
 * Utilidades de API
 */
async function fetchAPI(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * Formateo de datos
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES').format(date);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sistema de notificaciones
 */
function showNotification(message, type = 'success') {
    const container = document.getElementById('notifications');
    const id = 'notif-' + Date.now();
    
    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `alert alert-${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
            element.style.opacity = '0';
            setTimeout(() => element.remove(), 300);
        }
    }, 5000);
}

/**
 * Confirmación de acciones
 */
function confirmAction(message) {
    return confirm(message);
}
