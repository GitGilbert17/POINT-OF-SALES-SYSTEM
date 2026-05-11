const API_URL = 'http://localhost:5000';

let todosProductos = [];
let categorias = [];

document.addEventListener('DOMContentLoaded', async () => {
    const authToken = localStorage.getItem('token');
    
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }

    await cargarCategorias();
    await cargarProductos();
});

async function cargarCategorias() {
    try {
        const token = localStorage.getItem('token');
        const resp = await fetch(`${API_URL}/categorias`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (resp.ok) {
            categorias = await resp.json();
            
            // Llenar select de filtros
            const filtroSelect = document.getElementById('filtroCategoria');
            categorias.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id_categoria;
                option.textContent = c.nombre_categoria;
                filtroSelect.appendChild(option);
            });
            
            // Llenar select del modal
            const modalSelect = document.getElementById('productoCategoria');
            categorias.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id_categoria;
                option.textContent = c.nombre_categoria;
                modalSelect.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

async function cargarProductos() {
    const productosDiv = document.getElementById('productosList');
    const token = localStorage.getItem('token');
    
    try {
        const resp = await fetch(`${API_URL}/productos`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (resp.ok) {
            todosProductos = await resp.json();
            renderizarProductos(todosProductos);
        } else {
            productosDiv.innerHTML = '<p class="error">Error al cargar productos</p>';
        }
    } catch (e) {
        productosDiv.innerHTML = '<p class="error">Error de conexión</p>';
    }
}

function renderizarProductos(productos) {
    const productosDiv = document.getElementById('productosList');
    
    if (productos.length === 0) {
        productosDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>No hay productos</p></div>';
        return;
    }
    
    productosDiv.innerHTML = productos.map(p => {
        let stockClass = 'alto';
        if (p.stock_actual === 0) stockClass = 'agotado';
        else if (p.stock_actual <= p.stock_minimo) stockClass = 'bajo';
        
        return `
            <div class="producto-card">
                <div class="producto-imagen">📦</div>
                <div class="producto-info">
                    <h4>${p.nombre}</h4>
                    <p>${p.codigo} | ${p.categoria || 'Sin categoría'}</p>
                    <p>${p.descripcion || ''}</p>
                </div>
                <div class="producto-stock">
                    <span class="stock-badge ${stockClass}">${p.stock_actual} unidades</span>
                </div>
                <div class="producto-precio">$${Number(p.precio).toFixed(2)}</div>
                <div class="producto-acciones">
                    <button class="btn-icon btn-editar" onclick="editarProducto(${p.id})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-eliminar" onclick="eliminarProducto(${p.id})" title="Eliminar">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarProductos() {
    const buscar = document.getElementById('buscarProducto').value.toLowerCase();
    const categoria = document.getElementById('filtroCategoria').value;
    const stock = document.getElementById('filtroStock').value;
    
    let filtrados = todosProductos.filter(p => {
        const matchBuscar = p.nombre.toLowerCase().includes(buscar) || p.codigo.toLowerCase().includes(buscar);
        const matchCategoria = !categoria || p.id_categoria == categoria;
        
        let matchStock = true;
        if (stock === 'alto') matchStock = p.stock_actual > p.stock_minimo;
        if (stock === 'bajo') matchStock = p.stock_actual > 0 && p.stock_actual <= p.stock_minimo;
        if (stock === 'agotado') matchStock = p.stock_actual === 0;
        
        return matchBuscar && matchCategoria && matchStock;
    });
    
    renderizarProductos(filtrados);
}

function mostrarModalProducto(producto = null) {
    const modal = document.getElementById('productoModal');
    const form = document.getElementById('productoForm');
    const title = document.getElementById('modalTitle');
    
    if (producto) {
        title.textContent = 'Editar Producto';
        document.getElementById('productoId').value = producto.id;
        document.getElementById('productoCodigo').value = producto.codigo;
        document.getElementById('productoNombre').value = producto.nombre;
        document.getElementById('productoDescripcion').value = producto.descripcion || '';
        document.getElementById('productoCategoria').value = producto.id_categoria || '';
        document.getElementById('productoPrecioCosto').value = producto.precio_costo || 0;
        document.getElementById('productoPrecioVenta').value = producto.precio;
        document.getElementById('productoStock').value = producto.stock_actual;
        document.getElementById('productoStockMin').value = producto.stock_minimo;
        document.getElementById('productoItbis').value = producto.itbis_tasa;
    } else {
        title.textContent = 'Agregar Producto';
        form.reset();
        document.getElementById('productoId').value = '';
        document.getElementById('productoStock').value = '0';
        document.getElementById('productoStockMin').value = '10';
        document.getElementById('productoItbis').value = '18';
        document.getElementById('productoPrecioCosto').value = '0';
    }
    
    modal.classList.add('active');
}

function cerrarModalProducto() {
    document.getElementById('productoModal').classList.remove('active');
}

async function guardarProducto(e) {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    const id = document.getElementById('productoId').value;
    
    const producto = {
        codigo: document.getElementById('productoCodigo').value,
        nombre: document.getElementById('productoNombre').value,
        descripcion: document.getElementById('productoDescripcion').value || null,
        id_categoria: document.getElementById('productoCategoria').value || null,
        precio_costo: parseFloat(document.getElementById('productoPrecioCosto').value) || 0,
        precio_venta: parseFloat(document.getElementById('productoPrecioVenta').value),
        stock_actual: parseInt(document.getElementById('productoStock').value) || 0,
        stock_minimo: parseInt(document.getElementById('productoStockMin').value) || 10,
        itbis_tasa: parseFloat(document.getElementById('productoItbis').value) || 18
    };
    
    try {
        let url = `${API_URL}/productos`;
        let method = 'POST';
        
        if (id) {
            url = `${API_URL}/productos/${id}`;
            method = 'PUT';
        }
        
        const resp = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(producto)
        });
        
        if (resp.ok) {
            alert(id ? 'Producto actualizado' : 'Producto creado');
            cerrarModalProducto();
            cargarProductos();
        } else {
            const data = await resp.json();
            alert(data.message || 'Error al guardar');
        }
    } catch (e) {
        alert('Error de conexión');
    }
}

function editarProducto(id) {
    const producto = todosProductos.find(p => p.id === id);
    if (producto) {
        mostrarModalProducto(producto);
    }
}

async function eliminarProducto(id) {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const resp = await fetch(`${API_URL}/productos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (resp.ok) {
            alert('Producto eliminado');
            cargarProductos();
        } else {
            alert('Error al eliminar');
        }
    } catch (e) {
        alert('Error de conexión');
    }
}

// Make functions global
window.mostrarModalProducto = mostrarModalProducto;
window.cerrarModalProducto = cerrarModalProducto;
window.guardarProducto = guardarProducto;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.filtrarProductos = filtrarProductos;