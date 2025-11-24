<?php
/**
 * API REST para Gestión de Inventario
 * Métodos: GET, PUT
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT');
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
        case 'PUT':
            handlePut($db);
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
 * GET - Obtener información de inventario
 */
function handleGet($db)
{
    if (isset($_GET['low_stock'])) {
        // Obtener productos con stock bajo
        $stmt = $db->prepare("
            SELECT p.*, i.quantity, i.min_stock,
                   (i.min_stock - i.quantity) as deficit
            FROM products p
            INNER JOIN inventory i ON p.id = i.product_id
            WHERE i.quantity < i.min_stock
            ORDER BY deficit DESC
        ");
        $stmt->execute();
        $lowStock = $stmt->fetchAll();

        echo json_encode($lowStock);
    } elseif (isset($_GET['stats'])) {
        // Obtener estadísticas de inventario
        $stmt = $db->query("
            SELECT 
                COUNT(*) as total_products,
                SUM(quantity) as total_items,
                SUM(CASE WHEN quantity < min_stock THEN 1 ELSE 0 END) as low_stock_count,
                SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
            FROM inventory
        ");
        $stats = $stmt->fetch();

        echo json_encode($stats);
    } else {
        // Obtener todo el inventario
        $stmt = $db->query("
            SELECT p.id, p.name, p.category, p.price, 
                   i.quantity, i.min_stock, i.last_updated,
                   CASE 
                       WHEN i.quantity = 0 THEN 'sin_stock'
                       WHEN i.quantity < i.min_stock THEN 'stock_bajo'
                       ELSE 'ok'
                   END as status
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            ORDER BY p.name
        ");
        $inventory = $stmt->fetchAll();

        echo json_encode($inventory);
    }
}

/**
 * PUT - Actualizar inventario
 */
function handlePut($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['product_id']) || !isset($data['quantity'])) {
        http_response_code(400);
        echo json_encode(['error' => 'product_id y quantity son requeridos']);
        return;
    }

    $stmt = $db->prepare("
        UPDATE inventory 
        SET quantity = :quantity,
            min_stock = :min_stock
        WHERE product_id = :product_id
    ");

    $result = $stmt->execute([
        'product_id' => $data['product_id'],
        'quantity' => $data['quantity'],
        'min_stock' => $data['min_stock'] ?? 10
    ]);

    if ($result) {
        echo json_encode([
            'success' => true,
            'message' => 'Inventario actualizado exitosamente'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar inventario']);
    }
}
?>