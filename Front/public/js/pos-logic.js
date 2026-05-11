// Variables globales
let productos = [];
let carrito = [];
let authToken = localStorage.getItem('token');
let descuentoGlobal = 0;

// Función para obtener productos desde el backend
async function cargarProductos() {
    try {
        const response = await fetch('http://localhost:5000/productos', {
            headers: {
                'Authorization': 'Bearer ' + authToken
            }
        });

        if (response.ok) {
            productos = await response.json();
            renderProductos(productos);
        } else {
            console.error('Error al cargar productos:', response.status);
            renderProductos([]); // Mostrar vacío si hay error
        }
    } catch (error) {
        console.error('Error de conexión al cargar productos:', error);
        renderProductos([]); // Mostrar vacío si hay error
    }
}


// Renderizar la cuadrícula de productos en el DOM
function renderProductos(items = productos) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = items.map(prod => `
        <div class="product-card">
            <div class="product-image">🍔</div>
            <div class="product-name">${prod.nombre}</div>
            <div class="product-price">$${Number(prod.precio).toFixed(2)}</div>
            <button class="add-btn" onclick="agregarAlCarrito(${prod.id})">Agregar</button>
        </div>
    `).join('');
}

// Lógica para agregar productos al carrito o incrementar su cantidad
function agregarAlCarrito(productId) {
    const producto = productos.find(p => p.id === productId);
    const itemCarrito = carrito.find(item => item.id === productId);

    if (itemCarrito) {
        itemCarrito.cantidad++;
    } else {
        carrito.push({
            ...producto,
            cantidad: 1
        });
    }

    actualizarCarrito();
}

// Modificar la cantidad de un item específico en el carrito
function actualizarCantidad(productId, cantidad) {
    const item = carrito.find(item => item.id === productId);
    if (item) {
        item.cantidad = Math.max(0, cantidad);
        if (item.cantidad === 0) {
            carrito = carrito.filter(item => item.id !== productId);
        }
        actualizarCarrito();
    }
}

// Eliminar un producto por completo del carrito
function eliminarDelCarrito(productId) {
    carrito = carrito.filter(item => item.id !== productId);
    actualizarCarrito();
}

// Actualizar la interfaz visual del carrito y recalcular totales
function actualizarCarrito() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) return;

    if (carrito.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛍️</div>
                <p>El carrito está vacío</p>
            </div>
        `;
    } else {
        cartItems.innerHTML = carrito.map(item => `
            <div class="cart-item">
                <div class="item-info">
                    <div class="item-name">${item.nombre}</div>
                    <div class="item-price">$${Number(item.precio).toFixed(2)} c/u</div>
                    <div class="item-controls">
                        <button class="qty-btn" onclick="actualizarCantidad(${item.id}, ${item.cantidad - 1})">−</button>
                        <div class="qty">${item.cantidad}</div>
                        <button class="qty-btn" onclick="actualizarCantidad(${item.id}, ${item.cantidad + 1})">+</button>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">$${(Number(item.precio) * item.cantidad).toFixed(2)}</div>
                    <span class="remove-btn" onclick="eliminarDelCarrito(${item.id})">×</span>
                </div>
            </div>
        `).join('');
    }

    calcularTotales();
}

// Calcular Subtotal, IVA (18%), descuento y Total general
function calcularTotales() {
    const subtotal = carrito.reduce((sum, item) => sum + (Number(item.precio) * item.cantidad), 0);
    const itbis = subtotal * 0.18;
    const descuento = subtotal * (descuentoGlobal / 100);
    const total = subtotal + itbis - descuento;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('tax').textContent = `$${itbis.toFixed(2)}`;
    
    if (descuentoGlobal > 0) {
        // Add discount display if there's a discount
        let summaryEl = document.querySelector('.summary');
        if (summaryEl && !document.getElementById('discountRow')) {
            const discountRow = document.createElement('div');
            discountRow.className = 'summary-row';
            discountRow.id = 'discountRow';
            discountRow.innerHTML = `<dt>Descuento (${descuentoGlobal}%):</dt><dd>-$${descuento.toFixed(2)}</dd>`;
            summaryEl.insertBefore(discountRow, summaryEl.children[summaryEl.children.length - 1]);
        } else if (document.getElementById('discountRow')) {
            document.getElementById('discountRow').innerHTML = `<dt>Descuento (${descuentoGlobal}%):</dt><dd>-$${descuento.toFixed(2)}</dd>`;
        }
    }
    
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    return { subtotal, itbis, descuento, total };
}

// Aplicar descuento global
function aplicarDescuento(porcentaje) {
    descuentoGlobal = Math.max(0, Math.min(100, porcentaje));
    calcularTotales();
}

// Limpiar descuento
function limpiarDescuento() {
    descuentoGlobal = 0;
    const discountRow = document.getElementById('discountRow');
    if (discountRow) discountRow.remove();
    calcularTotales();
}

// Vaciar el contenido del carrito previo aviso
function limpiarCarrito() {
    if (carrito.length > 0 && confirm('¿Estás seguro de que deseas limpiar el carrito?')) {
        carrito = [];
        actualizarCarrito();
    }
}

// Procesar el pago y guardar en la base de datos
async function procesarPago() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    const authToken = localStorage.getItem('token');
    if (!authToken) {
        alert('Sesión expirada. Por favor inicie sesión nuevamente.');
        window.location.href = 'index.html';
        return;
    }

    const totals = calcularTotales();
    
    // Show payment modal
    const metodoPago = prompt('Método de pago:\n1. Efectivo\n2. Tarjeta\n3. Mixto\n\nIngrese el número:');
    
    if (!metodoPago || metodoPago < '1' || metodoPago > '3') {
        return;
    }
    
    const metodos = { '1': 'efectivo', '2': 'tarjeta', '3': 'mixto' };
    const metodo = metodos[metodoPago];
    
    let montoPago = null;
    if (metodo === 'efectivo') {
        const entrada = prompt(`Total: $${totals.total.toFixed(2)}\n\nIngrese monto recibido:`);
        montoPago = parseFloat(entrada);
        if (isNaN(montoPago) || montoPago < totals.total) {
            alert('Monto insuficiente');
            return;
        }
    }

    const items = carrito.map(item => ({
        id_producto: item.id,
        cantidad: item.cantidad
    }));

    try {
        const response = await fetch('http://localhost:5000/ventas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({
                items: items,
                metodo_pago: metodo,
                monto_pago: montoPago,
                descuento: descuentoGlobal
            })
        });

        const data = await response.json();

        if (response.ok && data.ok) {
            const cambio = data.cambio || 0;
            alert(`¡Pago procesado!\n\nTotal: $${data.monto_total.toFixed(2)}\nMétodo: ${metodo}\nCambio: $${cambio.toFixed(2)}\n\nVenta #${data.id_venta}\n\nGracias por su compra.`);
            
            // Recargar productos para actualizar stock
            await cargarProductos();
            carrito = [];
            descuentoGlobal = 0;
            actualizarCarrito();
        } else {
            alert(data.message || 'Error al procesar la venta');
        }
    } catch (error) {
        console.error('Error al procesar pago:', error);
        alert('Error de conexión. Verifique que el servidor esté corriendo.');
    }
}

// Configurar el evento de búsqueda para filtrar productos
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = productos.filter(p => p.nombre.toLowerCase().includes(query));
    renderProductos(filtered);
});

// Inicializar la carga de productos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Load user info
    cargarUsuario();
    // Load products
    cargarProductos();
    // Load sales summary (admin only)
    cargarResumen();
});

// Cargar información del usuario autenticado
async function cargarUsuario() {
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }
    try {
        const resp = await fetch('http://localhost:5000/me', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (resp.ok) {
            const data = await resp.json();
            const usuario = data.usuario;
            document.getElementById('userName').textContent = usuario.nombre_completo || usuario.username;
            document.getElementById('userRole').textContent = usuario.rol;
            // Set avatar initials
            const name = usuario.nombre_completo || usuario.username;
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
            document.getElementById('userAvatar').textContent = initials;
        } else {
            // Token invalid, redirect to login
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error al cargar usuario:', error);
    }
}

// Cargar resumen de ventas (solo admin)
async function cargarResumen() {
    if (!authToken) return;
    try {
        const resp = await fetch('http://localhost:5000/ventas/resumen', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (resp.ok) {
            const resumen = await resp.json();
            const statsBar = document.getElementById('statsBar');
            if (statsBar) {
                statsBar.style.display = 'flex';
                statsBar.innerHTML = `
                    <div><strong>Ingresos hoy:</strong> $${resumen.ingresos.toFixed(2)}</div>
                    <div><strong>Ventas hoy:</strong> ${resumen.ventas}</div>
                    <div><strong>Promedio:</strong> $${resumen.promedio.toFixed(2)}</div>
                `;
            }
        } else if (resp.status === 403) {
            // Not admin, hide stats bar
            const statsBar = document.getElementById('statsBar');
            if (statsBar) statsBar.style.display = 'none';
        }
    } catch (error) {
        console.error('Error al cargar resumen:', error);
    }
}

 //LLevar el login de registro al Dashboard
document.querySelector('form').addEventListener('submit', function(e) {
     e.preventDefault();

     window.location.href="Dashboard.html"
});