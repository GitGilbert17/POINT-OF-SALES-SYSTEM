const API_URL = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', async () => {
    const authToken = localStorage.getItem('token');
    
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }

    // Set default dates (last 30 days)
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 30);
    
    document.getElementById('fechaDesde').value = hace30.toISOString().split('T')[0];
    document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];

    await Promise.all([
        cargarReportes(),
        cargarProductosVendidos(),
        cargarClientesTop()
    ]);
});

function mostrarError(container, mensaje) {
    container.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${mensaje}</p>
            <button onclick="location.reload()">Reintentar</button>
        </div>
    `;
}

function mostrarLoading(container) {
    container.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando datos...</p>
        </div>
    `;
}

async function cargarReportes() {
    const token = localStorage.getItem('token');
    const resumenContainer = document.getElementById('resumenVentas');
    const tablaContainer = document.getElementById('tablaVentas');
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    
    mostrarLoading(resumenContainer);
    mostrarLoading(tablaContainer);
    
    try {
        const resp = await fetch(`${API_URL}/reportes/ventas?fechaDesde=${desde}&fechaHasta=${hasta}`, {
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });
        
        if (resp.status === 403) {
            mostrarError(resumenContainer, 'No tienes permiso para ver reportes');
            mostrarError(tablaContainer, 'Contacta al administrador');
            return;
        }
        
        if (!resp.ok) {
            const error = await resp.json().catch(() => ({ message: 'Error desconocido' }));
            throw new Error(error.message || `Error ${resp.status}`);
        }
        
        const data = await resp.json();
        
        if (data.resumen && data.ventas) {
            renderizarResumenVentas(data.resumen);
            renderizarTablaVentas(data.ventas);
        } else {
            throw new Error('Formato de datos incorrecto');
        }
    } catch (e) {
        console.error('Error cargando reportes:', e);
        mostrarError(resumenContainer, 'Error al cargar reportes');
        mostrarError(tablaContainer, e.message);
    }
}

function renderizarResumenVentas(resumen) {
    const container = document.getElementById('resumenVentas');
    container.innerHTML = `
        <div class="tarjeta-resumen">
            <div class="valor">${resumen.cantidad || 0}</div>
            <div class="etiqueta">Ventas</div>
        </div>
        <div class="tarjeta-resumen">
            <div class="valor">$${(resumen.total || 0).toFixed(2)}</div>
            <div class="etiqueta">Ingresos</div>
        </div>
        <div class="tarjeta-resumen">
            <div class="valor">$${(resumen.itbis || 0).toFixed(2)}</div>
            <div class="etiqueta">ITBIS</div>
        </div>
        <div class="tarjeta-resumen">
            <div class="valor">$${(resumen.descuentos || 0).toFixed(2)}</div>
            <div class="etiqueta">Descuentos</div>
        </div>
    `;
}

function renderizarTablaVentas(ventas) {
    const container = document.getElementById('tablaVentas');
    
    if (!ventas || ventas.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay ventas en este período</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="tabla-reportes">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Usuario</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>
                ${ventas.map(v => `
                    <tr>
                        <td>#${v.id_venta}</td>
                        <td>${new Date(v.fecha_venta).toLocaleString('es-ES')}</td>
                        <td>${v.cliente || 'Mostrador'}</td>
                        <td>${v.usuario || '-'}</td>
                        <td>${v.metodo_pago || 'N/A'}</td>
                        <td>$${Number(v.monto_total || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn-ver" onclick="verRecibo(${v.id_venta})">Ver</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function cargarProductosVendidos() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('tablaProductos');
    
    mostrarLoading(container);
    
    try {
        const resp = await fetch(`${API_URL}/reportes/productos-mas-vendidos?limite=10`, {
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });
        
        if (!resp.ok) {
            const error = await resp.json().catch(() => ({ message: 'Error desconocido' }));
            throw new Error(error.message || `Error ${resp.status}`);
        }
        
        const productos = await resp.json();
        renderizarTablaProductos(productos);
    } catch (e) {
        console.error('Error cargando productos:', e);
        mostrarError(container, e.message);
    }
}

function renderizarTablaProductos(productos) {
    const container = document.getElementById('tablaProductos');
    
    if (!productos || productos.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay productos vendidos</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="tabla-reportes">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Cantidad Vendida</th>
                    <th>Ventas Totales</th>
                </tr>
            </thead>
            <tbody>
                ${productos.map((p, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${p.codigo || '-'}</td>
                        <td>${p.nombre || '-'}</td>
                        <td>${p.cantidad_vendida || 0}</td>
                        <td>$${Number(p.ventas_totales || 0).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function cargarClientesTop() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('tablaClientes');
    
    mostrarLoading(container);
    
    try {
        const resp = await fetch(`${API_URL}/reportes/clientes-top?limite=10`, {
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });
        
        if (!resp.ok) {
            const error = await resp.json().catch(() => ({ message: 'Error desconocido' }));
            throw new Error(error.message || `Error ${resp.status}`);
        }
        
        const clientes = await resp.json();
        renderizarTablaClientes(clientes);
    } catch (e) {
        console.error('Error cargando clientes:', e);
        mostrarError(container, e.message);
    }
}

function renderizarTablaClientes(clientes) {
    const container = document.getElementById('tablaClientes');
    
    if (!clientes || clientes.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay clientes registrados</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="tabla-reportes">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Identificación</th>
                    <th>Nombre</th>
                    <th>Compras</th>
                    <th>Total Comprado</th>
                </tr>
            </thead>
            <tbody>
                ${clientes.map((c, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${c.identificacion || '-'}</td>
                        <td>${c.nombre || '-'}</td>
                        <td>${c.numero_compras || 0}</td>
                        <td>$${Number(c.total_compras || 0).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function cambiarTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const tabBtn = document.querySelector(`.tab[onclick="cambiarTab('${tab}')"]`);
    if (tabBtn) tabBtn.classList.add('active');
    const tabContent = document.getElementById(`tab-${tab}`);
    if (tabContent) tabContent.classList.add('active');
}

function generarReporte() {
    cargarReportes();
}

async function verRecibo(idVenta) {
    const token = localStorage.getItem('token');
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Cargando...';
    btn.disabled = true;
    
    try {
        const resp = await fetch(`${API_URL}/ventas/${idVenta}/recibo`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!resp.ok) {
            throw new Error('Error al cargar recibo');
        }
        
        const data = await resp.json();
        mostrarRecibo(data);
    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function mostrarRecibo(data) {
    const v = data.venta;
    const detalles = data.detalles || [];
    const pagos = data.pagos || [];
    
    const contenido = document.getElementById('contenidoRecibo');
    contenido.innerHTML = `
        <div style="text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 1rem; margin-bottom: 1rem;">
            <h2 style="margin: 0; font-size: 1.5rem;">PUNTO DE VENTA</h2>
            <p style="margin: 0.25rem 0;">Sistema POS</p>
            <p style="margin: 0.25rem 0; font-size: 0.85rem;">Fecha: ${new Date(v.fecha_venta).toLocaleString('es-ES')}</p>
        </div>
        
        <div style="border-bottom: 2px dashed #ccc; padding-bottom: 1rem; margin-bottom: 1rem;">
            <p style="margin: 0.25rem 0;"><strong>Venta #${v.id_venta}</strong></p>
            <p style="margin: 0.25rem 0;">Cliente: ${v.cliente_nombre || 'Mostrador'}</p>
            <p style="margin: 0.25rem 0;">Cajero: ${v.usuario_nombre || '-'}</p>
        </div>
        
        <div style="margin-bottom: 1rem;">
            ${detalles.length > 0 ? detalles.map(d => `
                <div style="display: flex; justify-content: space-between; margin: 0.5rem 0;">
                    <div>
                        <div>${d.nombre || 'Producto'}</div>
                        <div style="font-size: 0.85rem; color: #666;">${d.cantidad} x $${Number(d.precio_unitario || 0).toFixed(2)}</div>
                    </div>
                    <div style="font-weight: bold;">$${Number(d.subtotal_item || 0).toFixed(2)}</div>
                </div>
            `).join('') : '<p>Sin productos</p>'}
        </div>
        
        <div style="border-top: 2px dashed #ccc; padding-top: 1rem; margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between;">
                <span>Subtotal:</span>
                <span>$${Number(v.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>ITBIS (18%):</span>
                <span>$${Number(v.total_itbis || 0).toFixed(2)}</span>
            </div>
            ${(v.total_descuento || 0) > 0 ? `
            <div style="display: flex; justify-content: space-between;">
                <span>Descuento:</span>
                <span>-$${Number(v.total_descuento).toFixed(2)}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: bold; margin-top: 0.5rem;">
                <span>TOTAL:</span>
                <span>$${Number(v.monto_total || 0).toFixed(2)}</span>
            </div>
        </div>
        
        <div style="margin-top: 1rem; font-size: 0.85rem;">
            <p><strong>Método de pago:</strong> ${v.metodo_pago || 'N/A'}</p>
            ${pagos.length > 0 ? pagos.map(p => `
                <p style="margin: 0.25rem 0;">${p.metodo_pago}: $${Number(p.monto_pago || 0).toFixed(2)} | Cambio: $${Number(p.cambio || 0).toFixed(2)}</p>
            `).join('') : ''}
        </div>
        
        <div style="text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: #666;">
            <p>Gracias por su compra!</p>
            <p>Vuelva pronto</p>
        </div>
    `;
    
    document.getElementById('reciboModal').style.display = 'block';
}

function cerrarRecibo() {
    document.getElementById('reciboModal').style.display = 'none';
}

function imprimirRecibo() {
    window.print();
}

// Make functions global
window.cambiarTab = cambiarTab;
window.generarReporte = generarReporte;
window.verRecibo = verRecibo;
window.cerrarRecibo = cerrarRecibo;
window.imprimirRecibo = imprimirRecibo;
window.cargarReportes = cargarReportes;
window.cargarProductosVendidos = cargarProductosVendidos;
window.cargarClientesTop = cargarClientesTop;