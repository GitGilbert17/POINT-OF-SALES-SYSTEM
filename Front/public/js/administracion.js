document.addEventListener('DOMContentLoaded', async () => {
    const usuariosDiv = document.getElementById('usuariosList');
    const resumenDiv = document.getElementById('ventasResumen');

    try {
        const respUsuarios = await fetch('http://localhost:5000/usuarios', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        if (respUsuarios.ok) {
            const usuarios = await respUsuarios.json();
            usuariosDiv.innerHTML = usuarios.map(u => `
                <div class="cart-item">
                    <div class="item-info">
                        <div class="item-name">${u.nombre_completo} (@${u.username})</div>
                        <div class="item-price">Rol: ${u.rol} | Activo: ${u.activo ? 'Si' : 'No'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            usuariosDiv.textContent = 'Error al cargar usuarios';
        }
    } catch (e) {
        usuariosDiv.textContent = 'Error de conexión';
    }

    try {
        const respResumen = await fetch('http://localhost:5000/ventas/resumen', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        if (respResumen.ok) {
            const resumen = await respResumen.json();
            resumenDiv.innerHTML = `
                <dl class="summary">
                    <div class="summary-row"><dt>Ingresos hoy:</dt><dd>$${Number(resumen.ingresos || 0).toFixed(2)}</dd></div>
                    <div class="summary-row"><dt>Ventas hoy:</dt><dd>${resumen.ventas || 0}</dd></div>
                    <div class="summary-row"><dt>Promedio:</dt><dd>$${Number(resumen.promedio || 0).toFixed(2)}</dd></div>
                </dl>
            `;
        }
    } catch (e) {
        resumenDiv.textContent = 'Error al cargar resumen';
    }
});
