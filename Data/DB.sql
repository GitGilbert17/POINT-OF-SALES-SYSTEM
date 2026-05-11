create database if not exists POS;
use POS;

-- Tabla usuarios
  CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Para hashes seguros
    rol ENUM('admin', 'cajero') DEFAULT 'cajero',
    activo BOOLEAN DEFAULT TRUE,
    ultimo_login DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  
  -- Tabla de clientes
  CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    identificacion VARCHAR(20) UNIQUE, -- Cédula o RNC
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    telefono VARCHAR(20),
    direccion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabla de categorías de productos
  CREATE TABLE categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
  );

  -- Tabla de productos
  CREATE TABLE productos (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    id_categoria INT,
    precio_costo DECIMAL(12,2) DEFAULT 0.00,
    precio_venta DECIMAL(12,2) NOT NULL,
    itbis_tasa DECIMAL(5,2) DEFAULT 18.00,
    stock_actual INT DEFAULT 0,
    stock_minimo INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON DELETE SET NULL
  );

  -- Tabla de ventas
  CREATE TABLE ventas (
    id_venta INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_cliente INT,
    fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_itbis DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_descuento DECIMAL(12,2) DEFAULT 0.00,
    monto_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia', 'mixto') DEFAULT 'efectivo',
    estado ENUM('completada', 'anulada') DEFAULT 'completada',
    notas TEXT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE SET NULL
  );
  
  
  -- Tabla de detalles de ventas
  CREATE TABLE detalle_ventas (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12,2) NOT NULL,
    descuento_item DECIMAL(12,2) DEFAULT 0.00,
    itbis_item DECIMAL(12,2) DEFAULT 0.00,
    subtotal_item DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
  );

  -- Tabla de pagos (historial de pagos por venta)
  CREATE TABLE pagos (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia', 'mixto') NOT NULL,
    monto_pago DECIMAL(12,2) NOT NULL,
    cambio DECIMAL(12,2) DEFAULT 0.00,
    referencia VARCHAR(100), -- Para tarjetas/transferencias
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE
  );
  
    -- Datos de ejemplo para el esquema POS mejorado

  INSERT INTO usuarios (nombre_completo, username, password, rol, ultimo_login) VALUES
  ('Ana Martínez', 'ana', SHA2('ana123',256), 'admin', NULL),
  ('Juan Pérez', 'juan', SHA2('juan123',256), 'cajero', NULL);

  INSERT INTO clientes (identificacion, nombre, email, telefono, direccion) VALUES
  ('001-1234567-8', 'Café Central', 'contacto@cafecentral.com', '+506 2222 1111', 'San José, Calle 5'),
  ('002-7654321-0', 'Librería del Sol', 'info@sollibros.com', '+506 3333 2222', 'Heredia, Av. Central');

  INSERT INTO categorias (nombre_categoria, descripcion) VALUES
  ('Bebidas', 'Todas las bebidas, frías y calientes'),
  ('Comidas', 'Platos preparados y snacks');

  INSERT INTO productos (codigo, nombre, descripcion, id_categoria, precio_costo, precio_venta, stock_actual, stock_minimo) VALUES
  ('B001', 'Café Americano', 'Café filtrado, 200ml', 1, 0.50, 1.20, 100, 10),
  ('B002', 'Jugo Natural', 'Jugo de fruta fresca, 300ml', 1, 0.80, 1.80, 50, 10);
  
    -- Una venta simple con dos productos
  INSERT INTO ventas (id_usuario, id_cliente, subtotal, total_itbis,
  total_descuento, monto_total, metodo_pago, estado, notas) VALUES
  (2, 1, 0, 0, 0, 0, 'efectivo', 'completada', 'Venta en mostrador');

  -- Registro del pago (asumiendo id_venta = 1)
  INSERT INTO pagos (id_venta, metodo_pago, monto_pago, cambio, referencia)
  VALUES
  (1, 'efectivo', 5.00, 0.61, NULL);


  
  
  
