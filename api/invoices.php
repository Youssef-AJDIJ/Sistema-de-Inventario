<?php
/**
 * API REST para Gestión de Facturación
 * Métodos: GET, POST, PUT, DELETE
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            handleGet($db);
            break;
        case 'POST':
            handlePost($db);
            break;
        case 'PUT':
            handlePut($db);
            break;
        case 'DELETE':
            handleDelete($db);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/**
 * GET - Obtener facturas
 */
function handleGet($db)
{
    if (isset($_GET['id'])) {
        // Obtener factura específica con detalles
        $stmt = $db->prepare("
            SELECT i.*, c.name as customer_name, c.email, c.phone, 
                   c.address, c.tax_id as customer_tax_id
            FROM invoices i
            INNER JOIN customers c ON i.customer_id = c.id
            WHERE i.id = :id
        ");
        $stmt->execute(['id' => $_GET['id']]);
        $invoice = $stmt->fetch();

        if (!$invoice) {
            http_response_code(404);
            echo json_encode(['error' => 'Factura no encontrada']);
            return;
        }

        // Obtener items de la factura
        $stmt = $db->prepare("
            SELECT ii.*, p.name as product_name
            FROM invoice_items ii
            INNER JOIN products p ON ii.product_id = p.id
            WHERE ii.invoice_id = :invoice_id
        ");
        $stmt->execute(['invoice_id' => $_GET['id']]);
        $invoice['items'] = $stmt->fetchAll();

        echo json_encode($invoice);
    } elseif (isset($_GET['stats'])) {
        // Obtener estadísticas de facturación
        $stmt = $db->query("
            SELECT 
                COUNT(*) as total_invoices,
                SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'pagada' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN status = 'pagada' THEN total ELSE 0 END) as total_revenue,
                SUM(CASE WHEN status = 'pendiente' THEN total ELSE 0 END) as pending_amount,
                AVG(total) as average_invoice
            FROM invoices
        ");
        $stats = $stmt->fetch();

        echo json_encode($stats);
    } else {
        // Obtener todas las facturas con filtros
        $sql = "
            SELECT i.*, c.name as customer_name
            FROM invoices i
            INNER JOIN customers c ON i.customer_id = c.id
            WHERE 1=1
        ";

        $params = [];

        if (isset($_GET['customer_id'])) {
            $sql .= " AND i.customer_id = :customer_id";
            $params['customer_id'] = $_GET['customer_id'];
        }

        if (isset($_GET['status'])) {
            $sql .= " AND i.status = :status";
            $params['status'] = $_GET['status'];
        }

        if (isset($_GET['date_from'])) {
            $sql .= " AND i.invoice_date >= :date_from";
            $params['date_from'] = $_GET['date_from'];
        }

        if (isset($_GET['date_to'])) {
            $sql .= " AND i.invoice_date <= :date_to";
            $params['date_to'] = $_GET['date_to'];
        }

        $sql .= " ORDER BY i.invoice_date DESC, i.id DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $invoices = $stmt->fetchAll();

        echo json_encode($invoices);
    }
}

/**
 * POST - Crear nueva factura
 */
function handlePost($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['customer_id']) || !isset($data['items']) || empty($data['items'])) {
        http_response_code(400);
        echo json_encode(['error' => 'customer_id e items son requeridos']);
        return;
    }

    $db->beginTransaction();

    try {
        // Generar número de factura
        $stmt = $db->query("
            SELECT invoice_number FROM invoices 
            ORDER BY id DESC LIMIT 1
        ");
        $lastInvoice = $stmt->fetch();

        if ($lastInvoice) {
            $lastNumber = (int) substr($lastInvoice['invoice_number'], -3);
            $newNumber = $lastNumber + 1;
        } else {
            $newNumber = 1;
        }

        $invoiceNumber = 'FAC-' . date('Y') . '-' . str_pad($newNumber, 3, '0', STR_PAD_LEFT);

        // Crear factura
        $stmt = $db->prepare("
            INSERT INTO invoices (invoice_number, customer_id, invoice_date, status, notes) 
            VALUES (:invoice_number, :customer_id, :invoice_date, :status, :notes)
        ");

        $stmt->execute([
            'invoice_number' => $invoiceNumber,
            'customer_id' => $data['customer_id'],
            'invoice_date' => $data['invoice_date'] ?? date('Y-m-d'),
            'status' => $data['status'] ?? 'pendiente',
            'notes' => $data['notes'] ?? null
        ]);

        $invoiceId = $db->lastInsertId();

        // Insertar items de la factura
        $stmt = $db->prepare("
            INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) 
            VALUES (:invoice_id, :product_id, :quantity, :unit_price, :subtotal)
        ");

        foreach ($data['items'] as $item) {
            $subtotal = $item['quantity'] * $item['unit_price'];

            $stmt->execute([
                'invoice_id' => $invoiceId,
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'subtotal' => $subtotal
            ]);

            // Actualizar inventario
            $updateStmt = $db->prepare("
                UPDATE inventory 
                SET quantity = quantity - :quantity 
                WHERE product_id = :product_id
            ");
            $updateStmt->execute([
                'quantity' => $item['quantity'],
                'product_id' => $item['product_id']
            ]);
        }

        $db->commit();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'id' => $invoiceId,
            'invoice_number' => $invoiceNumber,
            'message' => 'Factura creada exitosamente'
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

/**
 * PUT - Actualizar factura
 */
function handlePut($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID es requerido']);
        return;
    }

    $stmt = $db->prepare("
        UPDATE invoices 
        SET status = :status,
            notes = :notes
        WHERE id = :id
    ");

    $stmt->execute([
        'id' => $data['id'],
        'status' => $data['status'] ?? 'pendiente',
        'notes' => $data['notes'] ?? null
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Factura actualizada exitosamente'
    ]);
}

/**
 * DELETE - Eliminar factura
 */
function handleDelete($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID es requerido']);
        return;
    }

    $db->beginTransaction();

    try {
        // Obtener items antes de eliminar para restaurar inventario
        $stmt = $db->prepare("
            SELECT product_id, quantity 
            FROM invoice_items 
            WHERE invoice_id = :id
        ");
        $stmt->execute(['id' => $data['id']]);
        $items = $stmt->fetchAll();

        // Restaurar inventario
        foreach ($items as $item) {
            $updateStmt = $db->prepare("
                UPDATE inventory 
                SET quantity = quantity + :quantity 
                WHERE product_id = :product_id
            ");
            $updateStmt->execute([
                'quantity' => $item['quantity'],
                'product_id' => $item['product_id']
            ]);
        }

        // Eliminar factura (los items se eliminan por CASCADE)
        $stmt = $db->prepare("DELETE FROM invoices WHERE id = :id");
        $stmt->execute(['id' => $data['id']]);

        $db->commit();

        if ($stmt->rowCount() > 0) {
            echo json_encode([
                'success' => true,
                'message' => 'Factura eliminada exitosamente'
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Factura no encontrada']);
        }
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}
?>