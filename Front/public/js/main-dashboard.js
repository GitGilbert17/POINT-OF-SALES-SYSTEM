const API_URL = 'http://localhost:5000';

let authToken = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }
    
    loadUserInfo();
    loadDashboardData();
    setupNavigation();
});

async function loadUserInfo() {
    try {
        const resp = await fetch(`${API_URL}/me`, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        
        if (resp.ok) {
            const data = await resp.json();
            const user = data.usuario;
            
            document.getElementById('userName').textContent = user.nombre_completo || user.username;
            document.getElementById('userRole').textContent = user.rol === 'admin' ? 'Administradora' : 'Cajera';
            
            const initials = (user.nombre_completo || user.username)
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            document.getElementById('userAvatar').textContent = initials;
        } else {
            logout();
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadDashboardData() {
    try {
        const respStats = await fetch(`${API_URL}/dashboard/estadisticas`, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        
        if (respStats.ok) {
            const stats = await respStats.json();
            document.getElementById('todaySales').textContent = `$${stats.hoy.total.toFixed(2)}`;
            document.getElementById('todayOrders').textContent = stats.hoy.cantidad || 0;
            document.getElementById('totalClients').textContent = stats.clientesNuevos || 0;
            document.getElementById('totalProducts').textContent = stats.productosBajoStock || 0;
        } else {
            // Fallback to old endpoints if admin
            const respResumen = await fetch(`${API_URL}/ventas/resumen`, {
                headers: { 'Authorization': 'Bearer ' + authToken }
            });
            
            if (respResumen.ok) {
                const resumen = await respResumen.json();
                document.getElementById('todaySales').textContent = `$${Number(resumen.ingresos).toFixed(2)}`;
                document.getElementById('todayOrders').textContent = resumen.ventas || 0;
            }
            
            const respClientes = await fetch(`${API_URL}/clientes`, {
                headers: { 'Authorization': 'Bearer ' + authToken }
            });
            
            if (respClientes.ok) {
                const clientes = await respClientes.json();
                document.getElementById('totalClients').textContent = clientes.length;
            }
            
            const respProductos = await fetch(`${API_URL}/productos`, {
                headers: { 'Authorization': 'Bearer ' + authToken }
            });
            
            if (respProductos.ok) {
                const productos = await respProductos.json();
                document.getElementById('totalProducts').textContent = productos.filter(p => p.stock_actual <= 10).length;
            }
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    const pages = {
        'inicio': 'MainDashboard.html',
        'dashboard': 'Dashboard.html',
        'productos': 'Inventario.html',
        'clientes': 'Clientes.html',
        'usuarios': 'Administracion.html',
        'reportes': 'Reportes.html',
        'config': 'Configuracion.html'
    };
    
    if (pages[page]) {
        window.location.href = pages[page];
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

function logout() {
    fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + authToken }
    }).finally(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = 'index.html';
    });
}

// Make functions available globally
window.navigateTo = navigateTo;
window.toggleSidebar = toggleSidebar;
window.logout = logout;