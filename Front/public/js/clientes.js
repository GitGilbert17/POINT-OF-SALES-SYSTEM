const API_URL = 'http://localhost:5000';

let todosClientes = [];

document.addEventListener('DOMContentLoaded', async () => {
    const authToken = localStorage.getItem('token');
    
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }

    await cargarClientes();
});

async function cargarClientes() {
    const lista = document.getElementById('clientesList');
    const token = localStorage.getItem('token');
    
    try {
        const resp = await fetch(`${API_URL}/clientes`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (resp.ok) {
            todosClientes = await resp.json();
            renderizarClientes(todosClientes);
        } else {
            lista.innerHTML = '<p class="error">Error al cargar clientes</p>';
        }
    } catch (e) {
        lista.innerHTML = '<p class="error">Error de conexión</p>';
    }
}

function renderizarClientes(clientes) {
    const lista = document.getElementById('clientesList');
    
    if (clientes.length === 0) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><p>No hay clientes</p></div>';
        return;
    }
    
    lista.innerHTML = clientes.map(c => {
        const iniciales = c.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return `
            <div class="cliente-card">
                <div class="cliente-avatar">${iniciales}</div>
                <div class="cliente-info">
                    <h4>${c.nombre}</h4>
                    <p>ID: ${c.identificacion}</p>
                </div>
                <div class="cliente-contacto">
                    ${c.email ? `<div class="contact-item">📧 ${c.email}</div>` : ''}
                    ${c.telefono ? `<div class="contact-item">📞 ${c.telefono}</div>` : ''}
                </div>
                <div class="cliente-acciones">
                    <button class="btn-icon btn-editar" onclick="editarCliente(${c.id_cliente})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-eliminar" onclick="eliminarCliente(${c.id_cliente})" title="Eliminar">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarClientes() {
    const buscar = document.getElementById('buscarCliente').value.toLowerCase();
    
    const filtrados = todosClientes.filter(c => 
        c.nombre.toLowerCase().includes(buscar) ||
        (c.identificacion && c.identificacion.toLowerCase().includes(buscar)) ||
        (c.email && c.email.toLowerCase().includes(buscar))
    );
    
    renderizarClientes(filtrados);
}

function mostrarModalCliente(cliente = null) {
    const modal = document.getElementById('clienteModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('clienteFormModal');
    
    if (cliente) {
        title.textContent = 'Editar Cliente';
        document.getElementById('clienteId').value = cliente.id_cliente;
        document.getElementById('clienteIdentificacion').value = cliente.identificacion;
        document.getElementById('clienteNombre').value = cliente.nombre;
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clienteDireccion').value = cliente.direccion || '';
    } else {
        title.textContent = 'Agregar Cliente';
        form.reset();
        document.getElementById('clienteId').value = '';
    }
    
    modal.style.display = 'flex';
}

function cerrarModalCliente() {
    document.getElementById('clienteModal').style.display = 'none';
}

async function guardarCliente(e) {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    const id = document.getElementById('clienteId').value;
    
    const cliente = {
        identificacion: document.getElementById('clienteIdentificacion').value,
        nombre: document.getElementById('clienteNombre').value,
        email: document.getElementById('clienteEmail').value || null,
        telefono: document.getElementById('clienteTelefono').value || null,
        direccion: document.getElementById('clienteDireccion').value || null
    };
    
    try {
        if (id) {
            // Edit - using POST to create new for now (backend doesn't have PUT for clients)
            const resp = await fetch(`${API_URL}/clientes/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(cliente)
            });
            
            if (resp.ok) {
                alert('Cliente actualizado');
                cerrarModalCliente();
                cargarClientes();
            } else {
                const data = await resp.json();
                alert(data.message || 'Error al actualizar');
            }
        } else {
            const resp = await fetch(`${API_URL}/clientes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(cliente)
            });
            
            if (resp.ok) {
                alert('Cliente creado');
                cerrarModalCliente();
                cargarClientes();
            } else {
                const data = await resp.json();
                alert(data.message || 'Error al crear');
            }
        }
    } catch (e) {
        alert('Error de conexión');
    }
}

function editarCliente(id) {
    const cliente = todosClientes.find(c => c.id_cliente === id);
    if (cliente) {
        mostrarModalCliente(cliente);
    }
}

async function eliminarCliente(id) {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const resp = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (resp.ok) {
            alert('Cliente eliminado');
            cargarClientes();
        } else {
            alert('Error al eliminar');
        }
    } catch (e) {
        alert('Error de conexión');
    }
}

// Keep original form handler
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('clienteForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevo = {
                identificacion: document.getElementById('identificacion').value.trim(),
                nombre: document.getElementById('nombre').value.trim(),
                email: document.getElementById('email').value.trim(),
                telefono: document.getElementById('telefono').value.trim()
            };
            try {
                const resp = await fetch('http://localhost:5000/clientes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: JSON.stringify(nuevo)
                });
                if (resp.ok) {
                    await cargarClientes();
                    form.reset();
                } else {
                    alert('Error al crear cliente');
                }
            } catch (e) {
                alert('Error de conexión');
            }
        });
    }
});

// Make functions global
window.mostrarModalCliente = mostrarModalCliente;
window.cerrarModalCliente = cerrarModalCliente;
window.guardarCliente = guardarCliente;
window.editarCliente = editarCliente;
window.eliminarCliente = eliminarCliente;
window.filtrarClientes = filtrarClientes;