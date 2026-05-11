document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('loginForm');
    if (!formulario) return;

    // If already logged in, redirect to dashboard
    if (localStorage.getItem('token')) {
        window.location.href = "MainDashboard.html";
        return;
    }

    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            alert('Por favor ingrese usuario y contraseña.');
            return;
        }

        try {
            const resp = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await resp.json();
            if (resp.ok && data.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                window.location.href = "MainDashboard.html";
            } else {
                alert(data.message || 'Credenciales inválidas.');
            }
        } catch (err) {
            console.error(err);
            alert('No se pudo conectar con el servidor. Verifique que el servidor esté corriendo.');
        }
    });
});
