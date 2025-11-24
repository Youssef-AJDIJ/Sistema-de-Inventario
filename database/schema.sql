-- Sistema de Gestión de Inventario y Facturación
-- Base de Datos MySQL

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS inventory_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_system;

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_category (category)
) ENGINE=InnoDB;

-- Tabla de inventario
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    min_stock INT NOT NULL DEFAULT 10,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product (product_id)
) ENGINE=InnoDB;

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- Tabla de facturas
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    invoice_date DATE NOT NULL,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status ENUM('pendiente', 'pagada', 'cancelada') DEFAULT 'pendiente',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_customer (customer_id),
    INDEX idx_date (invoice_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Tabla de ítems de factura
CREATE TABLE IF NOT EXISTS invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_invoice (invoice_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- Trigger para actualizar el total de la factura
DELIMITER $$
CREATE TRIGGER update_invoice_total_after_insert
AFTER INSERT ON invoice_items
FOR EACH ROW
BEGIN
    UPDATE invoices 
    SET total = (SELECT SUM(subtotal) FROM invoice_items WHERE invoice_id = NEW.invoice_id)
    WHERE id = NEW.invoice_id;
END$$

CREATE TRIGGER update_invoice_total_after_update
AFTER UPDATE ON invoice_items
FOR EACH ROW
BEGIN
    UPDATE invoices 
    SET total = (SELECT SUM(subtotal) FROM invoice_items WHERE invoice_id = NEW.invoice_id)
    WHERE id = NEW.invoice_id;
END$$

CREATE TRIGGER update_invoice_total_after_delete
AFTER DELETE ON invoice_items
FOR EACH ROW
BEGIN
    UPDATE invoices 
    SET total = (SELECT IFNULL(SUM(subtotal), 0) FROM invoice_items WHERE invoice_id = OLD.invoice_id)
    WHERE id = OLD.invoice_id;
END$$
DELIMITER ;

-- Insertar datos de ejemplo
INSERT INTO products (name, description, price, category) VALUES
('Laptop HP 15', 'Laptop HP 15.6 pulgadas, 8GB RAM, 256GB SSD', 599.99, 'Electrónica'),
('Mouse Inalámbrico', 'Mouse inalámbrico ergonómico', 19.99, 'Accesorios'),
('Teclado Mecánico', 'Teclado mecánico retroiluminado RGB', 79.99, 'Accesorios'),
('Monitor 24"', 'Monitor Full HD 24 pulgadas', 149.99, 'Electrónica'),
('Webcam HD', 'Webcam 1080p con micrófono', 49.99, 'Accesorios'),
('Disco Duro Externo 1TB', 'Disco duro externo USB 3.0', 59.99, 'Almacenamiento'),
('Memoria USB 32GB', 'Memoria USB 3.0 de alta velocidad', 12.99, 'Almacenamiento'),
('Auriculares Bluetooth', 'Auriculares inalámbricos con cancelación de ruido', 89.99, 'Audio'),
('Altavoz Portátil', 'Altavoz Bluetooth resistente al agua', 39.99, 'Audio'),
('Router WiFi', 'Router WiFi de doble banda', 69.99, 'Redes');

INSERT INTO inventory (product_id, quantity, min_stock) VALUES
(1, 15, 5),
(2, 50, 10),
(3, 25, 8),
(4, 20, 5),
(5, 30, 10),
(6, 40, 12),
(7, 100, 20),
(8, 35, 10),
(9, 45, 15),
(10, 18, 6);

INSERT INTO customers (name, email, phone, address, tax_id) VALUES
('Juan García López', 'juan.garcia@email.com', '+34 612 345 678', 'Calle Mayor 15, 28013 Madrid', 'B12345678'),
('María Rodríguez Sánchez', 'maria.rodriguez@email.com', '+34 623 456 789', 'Avenida de la Constitución 42, 41001 Sevilla', 'A87654321'),
('Pedro Martínez', 'pedro.martinez@email.com', '+34 634 567 890', 'Paseo de Gracia 98, 08008 Barcelona', 'C23456789'),
('Ana Fernández', 'ana.fernandez@email.com', '+34 645 678 901', 'Gran Vía 25, 46005 Valencia', 'B34567890'),
('Carlos Gómez', 'carlos.gomez@email.com', '+34 656 789 012', 'Calle Real 78, 50001 Zaragoza', 'A45678901');

-- Factura de ejemplo
INSERT INTO invoices (invoice_number, customer_id, invoice_date, status, notes) VALUES
('FAC-2024-001', 1, '2024-11-20', 'pagada', 'Primera compra del cliente');

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES
(1, 1, 1, 599.99, 599.99),
(1, 2, 2, 19.99, 39.98),
(1, 7, 5, 12.99, 64.95);
