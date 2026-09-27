CREATE DATABASE IF NOT EXISTS logistica_db;
USE logistica_db;

-- Esquema base. Debe coincidir con backend/models/database_models.py.
-- Los ALTER de upgrades para bases existentes estan en backend/main.py
-- (_migrar_usuarios, _migrar_rol_proveedor, _migrar_pedidos, _migrar_estado_recolectado).

-- 1. Tabla Usuarios (Autenticacion y Seguridad)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN', 'CONDUCTOR', 'CLIENTE', 'PROVEEDOR') NOT NULL,
    id_ref INT NULL, -- Id asociado en clientes, conductores o proveedores segun el rol
    foto VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla Clientes (pool global, no pertenece a ningun proveedor)
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    direccion TEXT NOT NULL
);

-- 3. Tabla Conductores
CREATE TABLE IF NOT EXISTS conductores (
    id_conductor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    licencia VARCHAR(50) NOT NULL UNIQUE,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL
);

-- 4. Tabla Vehiculos
CREATE TABLE IF NOT EXISTS vehiculos (
    id_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL,
    capacidad VARCHAR(50) NOT NULL
);

-- 5. Tabla Proveedores (comercios que envian paquetes)
CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    direccion TEXT NULL
);

-- 6. Tabla Pedidos
-- Flujo: PENDIENTE -> ASIGNADO (admin aprueba y asigna, genera codigo)
--   -> RECOLECTADO (conductor valida el codigo en el comercio)
--   -> EN_CAMINO (conductor lo pasa a entrega) -> ENTREGADO
CREATE TABLE IF NOT EXISTS pedidos (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_conductor INT NULL,
    id_vehiculo INT NULL,
    id_proveedor INT NULL,
    direccion TEXT NOT NULL,
    latitud DECIMAL(10, 8) NOT NULL,
    longitud DECIMAL(11, 8) NOT NULL,
    estado ENUM('PENDIENTE', 'ASIGNADO', 'RECOLECTADO', 'EN_CAMINO', 'ENTREGADO', 'INCIDENCIA', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    codigo_recolecta VARCHAR(20) NULL,
    incidencia_nota TEXT NULL,
    foto_entrega VARCHAR(255) NULL,
    firma_entrega TEXT NULL,
    entregado_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
    FOREIGN KEY (id_conductor) REFERENCES conductores(id_conductor) ON DELETE SET NULL,
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo) ON DELETE SET NULL,
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor) ON DELETE SET NULL
);

-- 7. Historial de estados de cada pedido
CREATE TABLE IF NOT EXISTS historial_pedidos (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    estado ENUM('PENDIENTE', 'ASIGNADO', 'RECOLECTADO', 'EN_CAMINO', 'ENTREGADO', 'INCIDENCIA', 'CANCELADO') NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nota TEXT NULL,
    foto VARCHAR(255) NULL,
    firma TEXT NULL,
    usuario VARCHAR(100) NULL,
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE
);

-- 8. Auditoria de acciones
CREATE TABLE IF NOT EXISTS auditoria (
    id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- DATOS DE PRUEBA (SEED DATA)
-- ==========================================

-- Clientes
INSERT INTO clientes (id_cliente, nombre, telefono, email, direccion) VALUES
(1, 'Juan Perez', '7111-2233', 'juan@mail.com', 'Colonia Escalon, San Salvador'),
(2, 'Maria Lopez', '7222-3344', 'maria@mail.com', 'Santa Tecla, La Libertad');

-- Conductores
INSERT INTO conductores (id_conductor, nombre, licencia, telefono) VALUES
(1, 'Roberto Silva', 'LIC-98765', '7700-1122'),
(2, 'Ana Rodriguez', 'LIC-12345', '7800-3344');

-- Vehiculos
INSERT INTO vehiculos (id_vehiculo, placa, tipo, capacidad) VALUES
(1, 'C-123456', 'Camion Isuzu', '3500 kg'),
(2, 'P-987654', 'Panel Van', '1200 kg');

-- Proveedores
INSERT INTO proveedores (id_proveedor, nombre, telefono, email, direccion) VALUES
(1, 'Farmacia San Jose', '7000-1000', 'farmacia.sanjose@correo.com', 'San Salvador'),
(2, 'Ferreteria Lopez', '7000-2000', 'ferreteria.lopez@correo.com', 'Santa Tecla');

-- Usuarios
INSERT INTO usuarios (username, password_hash, rol, id_ref) VALUES
('admin', '123', 'ADMIN', NULL),
('rsilva', '123', 'CONDUCTOR', 1),
('jperez', '123', 'CLIENTE', 1),
('fsanjose', '123', 'PROVEEDOR', 1);

-- Pedidos iniciales
INSERT INTO pedidos (id_pedido, id_cliente, id_proveedor, id_conductor, id_vehiculo, direccion, latitud, longitud, estado, codigo_recolecta) VALUES
(1, 1, 1, 1, 1, 'Plaza Salvador del Mundo, San Salvador', 13.70132600, -89.22442200, 'ASIGNADO', 'R-1234'),
(2, 2, 2, NULL, NULL, 'Centro Comercial Las Cascadas, Antiguo Cuscatlan', 13.67611100, -89.23666700, 'PENDIENTE', NULL);

-- Historial inicial
INSERT INTO historial_pedidos (id_pedido, estado, nota, usuario) VALUES
(1, 'PENDIENTE', 'Pedido creado', NULL),
(1, 'ASIGNADO', 'Aprobado y asignado al conductor Roberto Silva - Codigo de recolecta R-1234', 'admin');
