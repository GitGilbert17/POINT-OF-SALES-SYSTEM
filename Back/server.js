const express = require('express');
const crypto = require('crypto');
const { pool, testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const sessions = new Map();
const allowedOrigins = new Set([
  'null',
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    user,
    expiresAt: Date.now() + 1000 * 60 * 60 * 8
  });
  return token;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  const session = type === 'Bearer' && token ? sessions.get(token) : null;

  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ message: 'Sesion no valida' });
  }

  req.user = session.user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  next();
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, database: 'error', message: error.message });
  }
});

app.get('/usuarios', authenticate, requireAdmin, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id_usuario, nombre_completo, username, rol, activo, ultimo_login FROM usuarios WHERE activo = TRUE'
    );
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

app.get('/productos', authenticate, async (req, res) => {
  try {
    const [productos] = await pool.query(
      `SELECT
         p.id_producto AS id,
         p.codigo,
         p.nombre,
         p.descripcion,
         p.precio_venta AS precio,
         p.stock_actual,
         p.itbis_tasa,
         COALESCE(c.nombre_categoria, 'Sin categoria') AS categoria
       FROM productos p
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       WHERE p.activo = TRUE
       ORDER BY p.nombre`
    );

    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos' });
  }
});

app.get('/clientes', authenticate, async (req, res) => {
  try {
    const [clientes] = await pool.query(
      `SELECT id_cliente, identificacion, nombre, email, telefono
       FROM clientes
       WHERE activo = TRUE
       ORDER BY nombre`
    );

    res.json(clientes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clientes' });
  }
});

// Create a new client
app.post('/clientes', authenticate, async (req, res) => {
  const { identificacion, nombre, email, telefono } = req.body;
  // Basic validation
  if (!identificacion || !nombre) {
    return res.status(400).json({ message: 'Identificacion y nombre son obligatorios' });
  }
  try {
    const [result] = await pool.execute(
      `INSERT INTO clientes (identificacion, nombre, email, telefono, activo) VALUES (?, ?, ?, ?, TRUE)`,
      [identificacion, nombre, email || null, telefono || null]
    );
    const insertedId = result.insertId;
    const [newClientRows] = await pool.query(
      `SELECT id_cliente, identificacion, nombre, email, telefono FROM clientes WHERE id_cliente = ?`,
      [insertedId]
    );
    res.status(201).json(newClientRows[0]);
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ message: 'Error al crear cliente' });
  }
});

app.get('/ventas', authenticate, requireAdmin, async (req, res) => {
  try {
    const [ventas] = await pool.query(
      `SELECT
         v.id_venta,
         v.fecha_venta,
         v.estado,
         v.monto_total,
         COALESCE(c.nombre, 'Cliente general') AS cliente,
         COALESCE(SUM(dv.cantidad), 0) AS cantidad_total,
         GROUP_CONCAT(
           CONCAT(p.nombre, ' (', dv.cantidad, ')')
           ORDER BY p.nombre
           SEPARATOR ', '
         ) AS productos
       FROM ventas v
       LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
       LEFT JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
       LEFT JOIN productos p ON p.id_producto = dv.id_producto
       GROUP BY v.id_venta, v.fecha_venta, v.estado, v.monto_total, c.nombre
       ORDER BY v.fecha_venta DESC, v.id_venta DESC`
    );

    res.json(ventas);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ventas' });
  }
});

app.get('/ventas/resumen', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         COALESCE(SUM(v.monto_total), 0) AS ingresos,
         COUNT(v.id_venta) AS ventas,
         COALESCE(AVG(v.monto_total), 0) AS promedio,
         COALESCE(AVG(detalles.cantidad_total), 0) AS ticket_medio
       FROM ventas v
       LEFT JOIN (
         SELECT id_venta, SUM(cantidad) AS cantidad_total
         FROM detalle_ventas
         GROUP BY id_venta
       ) detalles ON detalles.id_venta = v.id_venta
       WHERE DATE(v.fecha_venta) = CURDATE()
         AND v.estado = 'completada'`
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener resumen' });
  }
});

app.post('/ventas', authenticate, async (req, res) => {
  const {
    items,
    id_cliente,
    metodo_pago = 'efectivo',
    monto_pago,
    referencia = null,
    notas = null,
    descuento = 0
  } = req.body;

  const validPaymentMethods = new Set(['efectivo', 'tarjeta', 'transferencia', 'mixto']);

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'La venta debe tener al menos un producto' });
  }

  if (!validPaymentMethods.has(metodo_pago)) {
    return res.status(400).json({ message: 'Metodo de pago invalido' });
  }

  const normalizedItems = items.map((item) => ({
    id_producto: Number(item.id_producto || item.id),
    cantidad: Number(item.cantidad)
  }));

  if (normalizedItems.some((item) => !Number.isInteger(item.id_producto) || !Number.isInteger(item.cantidad) || item.cantidad <= 0)) {
    return res.status(400).json({ message: 'Productos o cantidades invalidas' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const saleItems = [];
    let subtotal = 0;
    let totalItbis = 0;

    for (const item of normalizedItems) {
      const [rows] = await connection.execute(
        `SELECT id_producto, nombre, precio_venta, itbis_tasa, stock_actual
         FROM productos
         WHERE id_producto = ? AND activo = TRUE
         FOR UPDATE`,
        [item.id_producto]
      );

      if (rows.length === 0) {
        throw new Error(`Producto ${item.id_producto} no existe`);
      }

      const product = rows[0];
      if (Number(product.stock_actual) < item.cantidad) {
        throw new Error(`Stock insuficiente para ${product.nombre}`);
      }

      const precioUnitario = Number(product.precio_venta);
      const subtotalItem = precioUnitario * item.cantidad;
      const itbisItem = subtotalItem * (Number(product.itbis_tasa) / 100);

      subtotal += subtotalItem;
      totalItbis += itbisItem;

      saleItems.push({
        ...item,
        precio_unitario: precioUnitario,
        itbis_item: itbisItem,
        subtotal_item: subtotalItem
      });
    }

    const montoDescuento = subtotal * (Number(descuento) / 100);
    const montoTotal = subtotal + totalItbis - montoDescuento;
    const pago = monto_pago === undefined || monto_pago === null || monto_pago === ''
      ? montoTotal
      : Number(monto_pago);

    if (!Number.isFinite(pago) || pago < montoTotal) {
      throw new Error('El monto pagado no cubre el total');
    }

    const [ventaResult] = await connection.execute(
      `INSERT INTO ventas (
         id_usuario,
         id_cliente,
         subtotal,
         total_itbis,
         total_descuento,
         monto_total,
         metodo_pago,
         estado,
         notas
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completada', ?)`,
      [
        req.user.id_usuario,
        id_cliente ? Number(id_cliente) : null,
        subtotal.toFixed(2),
        totalItbis.toFixed(2),
        montoDescuento.toFixed(2),
        montoTotal.toFixed(2),
        metodo_pago,
        notas
      ]
    );

    const idVenta = ventaResult.insertId;

    for (const item of saleItems) {
      await connection.execute(
        `INSERT INTO detalle_ventas (
           id_venta,
           id_producto,
           cantidad,
           precio_unitario,
           descuento_item,
           itbis_item,
           subtotal_item
         ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [
          idVenta,
          item.id_producto,
          item.cantidad,
          item.precio_unitario.toFixed(2),
          item.itbis_item.toFixed(2),
          item.subtotal_item.toFixed(2)
        ]
      );

      await connection.execute(
        'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
        [item.cantidad, item.id_producto]
      );
    }

    await connection.execute(
      `INSERT INTO pagos (id_venta, metodo_pago, monto_pago, cambio, referencia)
       VALUES (?, ?, ?, ?, ?)`,
      [
        idVenta,
        metodo_pago,
        pago.toFixed(2),
        Math.max(pago - montoTotal, 0).toFixed(2),
        referencia || null
      ]
    );

    await connection.commit();

    res.status(201).json({
      ok: true,
      id_venta: idVenta,
      subtotal: Number(subtotal.toFixed(2)),
      total_itbis: Number(totalItbis.toFixed(2)),
      monto_total: Number(montoTotal.toFixed(2)),
      cambio: Number(Math.max(pago - montoTotal, 0).toFixed(2))
    });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ message: error.message || 'No se pudo procesar la venta' });
  } finally {
    connection.release();
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y password son requeridos' });
  }

  try {
    const [usuarios] = await pool.execute(
      `SELECT id_usuario, nombre_completo, username, rol
       FROM usuarios
       WHERE username = ? AND password = SHA2(?, 256) AND activo = TRUE
       LIMIT 1`,
      [username, password]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    await pool.execute('UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = ?', [
      usuarios[0].id_usuario
    ]);

    const token = createSession(usuarios[0]);
    res.json({ ok: true, token, usuario: usuarios[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error al validar login' });
  }
});

app.get('/me', authenticate, (req, res) => {
  res.json({ usuario: req.user });
});

app.post('/logout', authenticate, (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  sessions.delete(token);
  res.json({ ok: true });
});

// ========== CATEGORÍAS ==========
app.get('/categorias', authenticate, async (req, res) => {
  try {
    const [categorias] = await pool.query(
      'SELECT * FROM categorias WHERE activo = TRUE ORDER BY nombre_categoria'
    );
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
});

app.post('/categorias', authenticate, requireAdmin, async (req, res) => {
  const { nombre_categoria, descripcion } = req.body;
  if (!nombre_categoria) {
    return res.status(400).json({ message: 'Nombre de categoría es requerido' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO categorias (nombre_categoria, descripcion) VALUES (?, ?)',
      [nombre_categoria, descripcion || null]
    );
    res.status(201).json({ id_categoria: result.insertId, nombre_categoria, descripcion });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear categoría' });
  }
});

// ========== PRODUCTOS ==========
app.post('/productos', authenticate, requireAdmin, async (req, res) => {
  const { codigo, nombre, descripcion, id_categoria, precio_costo, precio_venta, itbis_tasa, stock_actual, stock_minimo } = req.body;
  
  if (!codigo || !nombre || !precio_venta) {
    return res.status(400).json({ message: 'Código, nombre y precio son requeridos' });
  }
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO productos (codigo, nombre, descripcion, id_categoria, precio_costo, precio_venta, itbis_tasa, stock_actual, stock_minimo, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [codigo, nombre, descripcion || null, id_categoria || null, precio_costo || 0, precio_venta, itbis_tasa || 18, stock_actual || 0, stock_minimo || 0]
    );
    
    const [producto] = await pool.query('SELECT * FROM productos WHERE id_producto = ?', [result.insertId]);
    res.status(201).json(producto[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: 'El código del producto ya existe' });
    } else {
      res.status(500).json({ message: 'Error al crear producto' });
    }
  }
});

app.put('/productos/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, descripcion, id_categoria, precio_costo, precio_venta, itbis_tasa, stock_actual, stock_minimo } = req.body;
  
  try {
    await pool.execute(
      `UPDATE productos SET codigo = ?, nombre = ?, descripcion = ?, id_categoria = ?, 
       precio_costo = ?, precio_venta = ?, itbis_tasa = ?, stock_actual = ?, stock_minimo = ?
       WHERE id_producto = ?`,
      [codigo, nombre, descripcion, id_categoria, precio_costo, precio_venta, itbis_tasa, stock_actual, stock_minimo, id]
    );
    
    const [producto] = await pool.query('SELECT * FROM productos WHERE id_producto = ?', [id]);
    if (producto.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json(producto[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar producto' });
  }
});

app.delete('/productos/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE productos SET activo = FALSE WHERE id_producto = ?', [id]);
    res.json({ ok: true, message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
});

// ========== CLIENTES ==========
app.put('/clientes/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { identificacion, nombre, email, telefono, direccion } = req.body;
  
  try {
    await pool.execute(
      'UPDATE clientes SET identificacion = ?, nombre = ?, email = ?, telefono = ?, direccion = ? WHERE id_cliente = ?',
      [identificacion, nombre, email, telefono, direccion, id]
    );
    
    const [cliente] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
    res.json(cliente[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cliente' });
  }
});

app.delete('/clientes/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE clientes SET activo = FALSE WHERE id_cliente = ?', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar cliente' });
  }
});

// ========== VENTAS ==========
app.get('/ventas/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [venta] = await pool.query(
      `SELECT v.*, c.nombre as cliente_nombre, u.nombre_completo as usuario_nombre
       FROM ventas v 
       LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
       LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
       WHERE v.id_venta = ?`,
      [id]
    );
    
    if (venta.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }
    
    const [detalles] = await pool.query(
      `SELECT dv.*, p.nombre, p.codigo 
       FROM detalle_ventas dv 
       JOIN productos p ON dv.id_producto = p.id_producto 
       WHERE dv.id_venta = ?`,
      [id]
    );
    
    res.json({ ...venta[0], detalles });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener venta' });
  }
});

app.delete('/ventas/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const [detalles] = await connection.query('SELECT id_producto, cantidad FROM detalle_ventas WHERE id_venta = ?', [id]);
    
    for (const item of detalles) {
      await connection.execute(
        'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
        [item.cantidad, item.id_producto]
      );
    }
    
    await connection.execute('UPDATE ventas SET estado = "anulada" WHERE id_venta = ?', [id]);
    
    await connection.commit();
    res.json({ ok: true, message: 'Venta anulada' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error al anular venta' });
  } finally {
    connection.release();
  }
});

// ========== DASHBOARD / ESTADÍSTICAS ==========
app.get('/dashboard/estadisticas', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[ventasHoy]] = await pool.query(
      `SELECT COALESCE(SUM(monto_total), 0) as total, COUNT(*) as cantidad 
       FROM ventas WHERE DATE(fecha_venta) = CURDATE() AND estado = 'completada'`
    );
    
    const [[ventasSemana]] = await pool.query(
      `SELECT COALESCE(SUM(monto_total), 0) as total, COUNT(*) as cantidad 
       FROM ventas WHERE fecha_venta >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND estado = 'completada'`
    );
    
    const [[ventasMes]] = await pool.query(
      `SELECT COALESCE(SUM(monto_total), 0) as total, COUNT(*) as cantidad 
       FROM ventas WHERE MONTH(fecha_venta) = MONTH(CURDATE()) AND YEAR(fecha_venta) = YEAR(CURDATE()) AND estado = 'completada'`
    );
    
    const [[productosBajoStock]] = await pool.query(
      'SELECT COUNT(*) as cantidad FROM productos WHERE stock_actual <= stock_minimo AND activo = TRUE'
    );
    
    const [[clientesNuevos]] = await pool.query(
      'SELECT COUNT(*) as cantidad FROM clientes WHERE DATE(created_at) = CURDATE()'
    );
    
    const [[topProducto]] = await pool.query(
      `SELECT p.nombre, SUM(dv.cantidad) as ventas
       FROM detalle_ventas dv
       JOIN productos p ON dv.id_producto = p.id_producto
       JOIN ventas v ON dv.id_venta = v.id_venta
       WHERE v.fecha_venta >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND v.estado = 'completada'
       GROUP BY p.id_producto
       ORDER BY ventas DESC
       LIMIT 1`
    );
    
    res.json({
      hoy: { total: Number(ventasHoy.total), cantidad: ventasHoy.cantidad },
      semana: { total: Number(ventasSemana.total), cantidad: ventasSemana.cantidad },
      mes: { total: Number(ventasMes.total), cantidad: ventasMes.cantidad },
      productosBajoStock: productosBajoStock.cantidad,
      clientesNuevos: clientesNuevos.cantidad,
      topProducto: topProducto || { nombre: 'N/A', ventas: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// ========== REPORTE DE INVENTARIO ==========
app.get('/inventario/reporte', authenticate, requireAdmin, async (req, res) => {
  try {
    const [productos] = await pool.query(
      `SELECT p.*, c.nombre_categoria as categoria
       FROM productos p
       LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
       WHERE p.activo = TRUE
       ORDER BY p.stock_actual ASC`
    );
    
    const bajoStock = productos.filter(p => p.stock_actual <= p.stock_minimo);
    const sinStock = productos.filter(p => p.stock_actual === 0);
    
    res.json({
      totalProductos: productos.length,
      bajoStock: bajoStock.length,
      sinStock: sinStock.length,
      valorInventario: productos.reduce((sum, p) => sum + (Number(p.precio_costo) * p.stock_actual), 0),
      productos
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reporte de inventario' });
  }
});

// ========== RECIBO ==========
app.get('/ventas/:id/recibo', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const [venta] = await pool.query(
      `SELECT v.*, c.nombre as cliente_nombre, c.identificacion as cliente_cedula, 
              u.nombre_completo as usuario_nombre
       FROM ventas v 
       LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
       LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
       WHERE v.id_venta = ?`,
      [id]
    );
    
    if (venta.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }
    
    const [detalles] = await pool.query(
      `SELECT dv.*, p.nombre, p.codigo 
       FROM detalle_ventas dv 
       JOIN productos p ON dv.id_producto = p.id_producto 
       WHERE dv.id_venta = ?`,
      [id]
    );
    
    const [pagos] = await pool.query(
      'SELECT * FROM pagos WHERE id_venta = ?',
      [id]
    );
    
    res.json({
      venta: venta[0],
      detalles,
      pagos
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener recibo' });
  }
});

// ========== REPORTES ==========
app.get('/reportes/ventas', authenticate, requireAdmin, async (req, res) => {
  const { fechaDesde, fechaHasta } = req.query;
  
  try {
    let query = `
      SELECT v.*, c.nombre as cliente, u.nombre_completo as usuario
      FROM ventas v
      LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
      WHERE v.estado = 'completada'
    `;
    const params = [];
    
    if (fechaDesde) {
      query += ' AND DATE(v.fecha_venta) >= ?';
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      query += ' AND DATE(v.fecha_venta) <= ?';
      params.push(fechaHasta);
    }
    
    query += ' ORDER BY v.fecha_venta DESC';
    
    const [ventas] = await pool.query(query, params);
    
    const totalVentas = ventas.reduce((sum, v) => sum + Number(v.monto_total), 0);
    const totalItbis = ventas.reduce((sum, v) => sum + Number(v.total_itbis), 0);
    const totalDescuentos = ventas.reduce((sum, v) => sum + Number(v.total_descuento || 0), 0);
    
    res.json({
      ventas,
      resumen: {
        cantidad: ventas.length,
        total: totalVentas,
        itbis: totalItbis,
        descuentos: totalDescuentos
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reporte de ventas' });
  }
});

app.get('/reportes/productos-mas-vendidos', authenticate, requireAdmin, async (req, res) => {
  const { limite = 10 } = req.query;
  
  try {
    const [productos] = await pool.query(
      `SELECT p.id_producto, p.nombre, p.codigo, p.precio_venta,
              SUM(dv.cantidad) as cantidad_vendida,
              SUM(dv.subtotal_item) as ventas_totales
       FROM detalle_ventas dv
       JOIN productos p ON dv.id_producto = p.id_producto
       JOIN ventas v ON dv.id_venta = v.id_venta
       WHERE v.estado = 'completada'
       GROUP BY p.id_producto
       ORDER BY cantidad_vendida DESC
       LIMIT ?`,
      [parseInt(limite)]
    );
    
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos más vendidos' });
  }
});

app.get('/reportes/clientes-top', authenticate, requireAdmin, async (req, res) => {
  const { limite = 10 } = req.query;
  
  try {
    const [clientes] = await pool.query(
      `SELECT c.id_cliente, c.nombre, c.identificacion, c.email,
              COUNT(v.id_venta) as numero_compras,
              SUM(v.monto_total) as total_compras
       FROM clientes c
       JOIN ventas v ON c.id_cliente = v.id_cliente
       WHERE v.estado = 'completada'
       GROUP BY c.id_cliente
       ORDER BY total_compras DESC
       LIMIT ?`,
      [parseInt(limite)]
    );
    
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clientes top' });
  }
});

// ========== USUARIOS (ADMIN) ==========
app.post('/usuarios', authenticate, requireAdmin, async (req, res) => {
  const { nombre_completo, username, password, rol } = req.body;
  
  if (!nombre_completo || !username || !password || !rol) {
    return res.status(400).json({ message: 'Todos los campos son requeridos' });
  }
  
  try {
    const [result] = await pool.execute(
      'INSERT INTO usuarios (nombre_completo, username, password, rol) VALUES (?, ?, SHA2(?, 256), ?)',
      [nombre_completo, username, password, rol]
    );
    
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: 'El usuario ya existe' });
    } else {
      res.status(500).json({ message: 'Error al crear usuario' });
    }
  }
});

app.put('/usuarios/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, username, rol, activo } = req.body;
  
  try {
    await pool.execute(
      'UPDATE usuarios SET nombre_completo = ?, username = ?, rol = ?, activo = ? WHERE id_usuario = ?',
      [nombre_completo, username, rol, activo, id]
    );
    
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

app.put('/usuarios/:id/password', authenticate, async (req, res) => {
  const { id } = req.params;
  const { password_actual, password_nueva } = req.body;
  
  if (!password_actual || !password_nueva) {
    return res.status(400).json({ message: 'Contraseñas requeridas' });
  }
  
  // Verify current password
  const [usuarios] = await pool.query(
    'SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND password = SHA2(?, 256)',
    [id, password_actual]
  );
  
  if (usuarios.length === 0) {
    return res.status(400).json({ message: 'Contraseña actual incorrecta' });
  }
  
  try {
    await pool.execute(
      'UPDATE usuarios SET password = SHA2(?, 256) WHERE id_usuario = ?',
      [password_nueva, id]
    );
    
    res.json({ ok: true, message: 'Contraseña actualizada' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
});

testConnection()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error al conectar a MySQL:', error.message);
    process.exit(1);
  });
