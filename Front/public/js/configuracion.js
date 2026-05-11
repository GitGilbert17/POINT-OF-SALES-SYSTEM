const API_URL = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', async () => {
    const authToken = localStorage.getItem('token');
    
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }

    const configDiv = document.getElementById('configuracion');

    async function cargarConfiguracion() {
        try {
            const respUser = await fetch(`${API_URL}/me`, {
                headers: { 'Authorization': 'Bearer ' + authToken }
            });

            if (respUser.ok) {
                const data = await respUser.json();
                const user = data.usuario;

                configDiv.innerHTML = `
                    <div class="config-section">
                        <h3>Información del Usuario</h3>
                        <div class="config-grid">
                            <div class="config-item">
                                <label>Nombre:</label>
                                <span>${user.nombre_completo || 'No definido'}</span>
                            </div>
                            <div class="config-item">
                                <label>Usuario:</label>
                                <span>@${user.username}</span>
                            </div>
                            <div class="config-item">
                                <label>Rol:</label>
                                <span class="rol-badge ${user.rol}">${user.rol}</span>
                            </div>
                            <div class="config-item">
                                <label>Estado:</label>
                                <span class="activo-badge si">Activo</span>
                            </div>
                        </div>
                    </div>

                    <div class="config-section">
                        <h3>Configuración del Sistema</h3>
                        <div class="config-grid">
                            <div class="config-item">
                                <label>Impuesto (ITBIS):</label>
                                <span>18%</span>
                            </div>
                            <div class="config-item">
                                <label>Moneda:</label>
                                <span>DOP (Peso Dominicano)</span>
                            </div>
                            <div class="config-item">
                                <label>API Server:</label>
                                <span>localhost:5000</span>
                            </div>
                            <div class="config-item">
                                <label>Base de Datos:</label>
                                <span>MySQL - POS</span>
                            </div>
                        </div>
                    </div>

                    <div class="config-section">
                        <h3>Acciones</h3>
                        <div class="config-actions">
                            <button class="btn-config" onclick="cambiarContrasena()">
                                <i class="fas fa-key"></i> Cambiar Contraseña
                            </button>
                            <button class="btn-config" onclick="exportarDatos()">
                                <i class="fas fa-download"></i> Exportar Datos
                            </button>
                            <button class="btn-config btn-danger" onclick="logout()">
                                <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                            </button>
                        </div>
                    </div>
                `;
            } else {
                configDiv.innerHTML = '<p class="error">Error al cargar configuración</p>';
            }
        } catch (e) {
            console.error('Error:', e);
            configDiv.innerHTML = '<p class="error">Error de conexión</p>';
        }
    }

    await cargarConfiguracion();
});

function cambiarContrasena() {
    alert('Función de cambio de contraseña en desarrollo');
}

function exportarDatos() {
    alert('Función de exportación en desarrollo');
}

function logout() {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    }).finally(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = 'index.html';
    });
}

window.logout = logout;