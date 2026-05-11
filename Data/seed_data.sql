USE POS;

-- Datos de prueba completos para el dashboard de administracion.
-- Se puede ejecutar despues de Data/DB.sql.

SET @admin_id := (SELECT id_usuario FROM usuarios WHERE username = 'ana' LIMIT 1);
SET @cajero_id := (SELECT id_usuario FROM usuarios WHERE username = 'juan' LIMIT 1);

INSERT INTO usuarios (nombre_completo, username, password, rol)
VALUES
  ('Carlos Rivera', 'carlos', SHA2('carlos123', 256), 'cajero'),
  ('Laura Gomez', 'laura', SHA2('laura123', 256), 'admin')
ON DUPLICATE KEY UPDATE
  nombre_completo = VALUES(nombre_completo),
  rol = VALUES(rol);

INSERT INTO clientes (identificacion, nombre, email, telefono, direccion)
VALUES
  ('003-1111111-1', 'Minimarket La Esquina', 'ventas@laesquina.com', '+1 809 555 0101', 'Av. Principal #45'),
  ('004-2222222-2', 'Oficina Nova', 'compras@oficinanova.com', '+1 809 555 0102', 'Calle Duarte #18'),
  ('005-3333333-3', 'Cliente Mostrador', NULL, NULL, 'Venta directa'),
  ('006-4444444-4', 'Panaderia Sol', 'admin@panaderiasol.com', '+1 809 555 0104', 'Zona Colonial')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  email = VALUES(email),
  telefono = VALUES(telefono),
  direccion = VALUES(direccion);

INSERT INTO categorias (nombre_categoria, descripcion)
SELECT 'Postres', 'Dulces, bizcochos y productos de reposteria'
WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre_categoria = 'Postres');

INSERT INTO categorias (nombre_categoria, descripcion)
SELECT 'Limpieza', 'Productos de limpieza para uso diario'
WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre_categoria = 'Limpieza');

INSERT INTO categorias (nombre_categoria, descripcion)
SELECT 'Papeleria', 'Articulos de oficina y escolares'
WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre_categoria = 'Papeleria');

SET @cat_bebidas := (SELECT id_categoria FROM categorias WHERE nombre_categoria = 'Bebidas' LIMIT 1);
SET @cat_comidas := (SELECT id_categoria FROM categorias WHERE nombre_categoria = 'Comidas' LIMIT 1);
SET @cat_postres := (SELECT id_categoria FROM categorias WHERE nombre_categoria = 'Postres' LIMIT 1);
SET @cat_limpieza := (SELECT id_categoria FROM categorias WHERE nombre_categoria = 'Limpieza' LIMIT 1);
SET @cat_papeleria := (SELECT id_categoria FROM categorias WHERE nombre_categoria = 'Papeleria' LIMIT 1);

INSERT INTO productos (
  codigo,
  nombre,
  descripcion,
  id_categoria,
  precio_costo,
  precio_venta,
  itbis_tasa,
  stock_actual,
  stock_minimo
)
VALUES
  ('B003', 'Agua Mineral', 'Botella de agua 500ml', @cat_bebidas, 0.35, 0.90, 18.00, 120, 20),
  ('B004', 'Refresco Cola', 'Lata de refresco 355ml', @cat_bebidas, 0.55, 1.35, 18.00, 90, 15),
  ('C001', 'Sandwich Club', 'Sandwich con pollo, queso y vegetales', @cat_comidas, 2.40, 5.50, 18.00, 35, 5),
  ('C002', 'Empanada de Pollo', 'Empanada horneada de pollo', @cat_comidas, 0.65, 1.75, 18.00, 80, 10),
  ('P001', 'Brownie', 'Brownie de chocolate', @cat_postres, 0.80, 2.25, 18.00, 45, 8),
  ('P002', 'Cheesecake', 'Porcion de cheesecake', @cat_postres, 1.50, 3.95, 18.00, 25, 5),
  ('L001', 'Jabon Liquido', 'Jabon liquido antibacterial 500ml', @cat_limpieza, 1.20, 2.80, 18.00, 40, 8),
  ('PA001', 'Cuaderno Rayado', 'Cuaderno rayado 100 hojas', @cat_papeleria, 0.95, 2.10, 18.00, 60, 10)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  id_categoria = VALUES(id_categoria),
  precio_costo = VALUES(precio_costo),
  precio_venta = VALUES(precio_venta),
  itbis_tasa = VALUES(itbis_tasa),
  stock_actual = VALUES(stock_actual),
  stock_minimo = VALUES(stock_minimo);

SET @cliente_esquina := (SELECT id_cliente FROM clientes WHERE identificacion = '003-1111111-1' LIMIT 1);
SET @cliente_oficina := (SELECT id_cliente FROM clientes WHERE identificacion = '004-2222222-2' LIMIT 1);
SET @cliente_mostrador := (SELECT id_cliente FROM clientes WHERE identificacion = '005-3333333-3' LIMIT 1);
SET @cliente_panaderia := (SELECT id_cliente FROM clientes WHERE identificacion = '006-4444444-4' LIMIT 1);

SET @prod_cafe := (SELECT id_producto FROM productos WHERE codigo = 'B001' LIMIT 1);
SET @prod_jugo := (SELECT id_producto FROM productos WHERE codigo = 'B002' LIMIT 1);
SET @prod_agua := (SELECT id_producto FROM productos WHERE codigo = 'B003' LIMIT 1);
SET @prod_refresco := (SELECT id_producto FROM productos WHERE codigo = 'B004' LIMIT 1);
SET @prod_sandwich := (SELECT id_producto FROM productos WHERE codigo = 'C001' LIMIT 1);
SET @prod_empanada := (SELECT id_producto FROM productos WHERE codigo = 'C002' LIMIT 1);
SET @prod_brownie := (SELECT id_producto FROM productos WHERE codigo = 'P001' LIMIT 1);
SET @prod_cheesecake := (SELECT id_producto FROM productos WHERE codigo = 'P002' LIMIT 1);
SET @prod_jabon := (SELECT id_producto FROM productos WHERE codigo = 'L001' LIMIT 1);
SET @prod_cuaderno := (SELECT id_producto FROM productos WHERE codigo = 'PA001' LIMIT 1);

INSERT INTO ventas (
  id_usuario,
  id_cliente,
  fecha_venta,
  subtotal,
  total_itbis,
  total_descuento,
  monto_total,
  metodo_pago,
  estado,
  notas
)
VALUES
  (@cajero_id, @cliente_mostrador, NOW() - INTERVAL 2 HOUR, 9.95, 1.79, 0.00, 11.74, 'efectivo', 'completada', 'Venta mostrador con comida y bebida'),
  (@cajero_id, @cliente_esquina, NOW() - INTERVAL 1 DAY, 20.75, 3.74, 1.00, 23.49, 'tarjeta', 'completada', 'Compra para minimarket'),
  (@admin_id, @cliente_oficina, NOW() - INTERVAL 2 DAY, 15.20, 2.74, 0.00, 17.94, 'transferencia', 'completada', 'Pedido de oficina'),
  (@cajero_id, @cliente_panaderia, NOW() - INTERVAL 3 DAY, 11.85, 2.13, 0.00, 13.98, 'mixto', 'completada', 'Venta mixta'),
  (@admin_id, @cliente_mostrador, NOW() - INTERVAL 4 DAY, 5.50, 0.99, 0.00, 6.49, 'efectivo', 'anulada', 'Venta anulada de prueba');

SET @venta_1 := LAST_INSERT_ID();
SET @venta_2 := @venta_1 + 1;
SET @venta_3 := @venta_1 + 2;
SET @venta_4 := @venta_1 + 3;
SET @venta_5 := @venta_1 + 4;

INSERT INTO detalle_ventas (
  id_venta,
  id_producto,
  cantidad,
  precio_unitario,
  descuento_item,
  itbis_item,
  subtotal_item
)
VALUES
  (@venta_1, @prod_sandwich, 1, 5.50, 0.00, 0.99, 5.50),
  (@venta_1, @prod_refresco, 2, 1.35, 0.00, 0.49, 2.70),
  (@venta_1, @prod_brownie, 1, 2.25, 0.00, 0.41, 2.25),
  (@venta_2, @prod_cafe, 6, 1.20, 0.00, 1.30, 7.20),
  (@venta_2, @prod_jugo, 4, 1.80, 0.00, 1.30, 7.20),
  (@venta_2, @prod_cheesecake, 2, 3.95, 1.00, 1.14, 6.90),
  (@venta_3, @prod_cuaderno, 5, 2.10, 0.00, 1.89, 10.50),
  (@venta_3, @prod_jabon, 1, 2.80, 0.00, 0.50, 2.80),
  (@venta_3, @prod_agua, 2, 0.90, 0.00, 0.32, 1.80),
  (@venta_4, @prod_empanada, 3, 1.75, 0.00, 0.95, 5.25),
  (@venta_4, @prod_jugo, 2, 1.80, 0.00, 0.65, 3.60),
  (@venta_4, @prod_brownie, 1, 2.25, 0.00, 0.41, 2.25),
  (@venta_4, @prod_agua, 1, 0.90, 0.00, 0.16, 0.90),
  (@venta_5, @prod_sandwich, 1, 5.50, 0.00, 0.99, 5.50);

INSERT INTO pagos (id_venta, metodo_pago, monto_pago, cambio, referencia)
VALUES
  (@venta_1, 'efectivo', 12.00, 0.26, NULL),
  (@venta_2, 'tarjeta', 23.49, 0.00, 'TARJ-000245'),
  (@venta_3, 'transferencia', 17.94, 0.00, 'TRX-20260507-001'),
  (@venta_4, 'efectivo', 8.00, 0.00, NULL),
  (@venta_4, 'tarjeta', 5.98, 0.00, 'TARJ-000246'),
  (@venta_5, 'efectivo', 6.49, 0.00, NULL);
