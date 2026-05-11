### Recomendada Estructura de Carpetas

1. `src/` (Código fuente)
   - `api/` (Rutas y controladores de API)
   - `controllers/` (Lógica de negocios)
   - `models/` (Interacciones con la base de datos, esporadicamente si usamos ORM)
   - `services/` (Servicios reutilizables o funciones auxiliares)
   - `utils/` (Funciones genéricas o helpers)

2. `config/` (Archivos de configuración)
   - `database.js` (Conexón a la base de datos)
   - `env/` (Variables de entorno)
   - `logging.js` (Configuración de logs)

3. `public/` (Activos estáticos si aplica)
   - `css/` (Archivos CSS)
   - `js/` (Scripts cliente)

4. `test/` (Pruebas)
   - `unit/` (Pruebas unitarias)
   - `integration/` (Pruebas de integración)

5. `docs/` (Documentación)
   - `api.md` (Documentación de endpoints)
   - `requirements.md` (Casos de uso)

6. `node_modules/` (Dependencias instaladas)

7. `logs/` (Archivos de logs generados)
