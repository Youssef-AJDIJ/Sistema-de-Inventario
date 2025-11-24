<?php
/**
 * API REST para Gestión de Productos
 * Métodos: GET, POST, PUT, DELETE
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

// Manejar preflight requests
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
 * GET - Obtener productos
 */
function handleGet($db)
{
    if (isset($_GET['id'])) {
        // Obtener producto específico con inventario
        $stmt = $db->prepare("
            SELECT p.*, i.quantity, i.min_stock 
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.id = :id
        ");
        $stmt->execute(['id' => $_GET['id']]);
        $product = $stmt->fetch();

        if ($product) {
            echo json_encode($product);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Producto no encontrado']);
        }
    } else {
        // Obtener todos los productos con inventario
        $search = isset($_GET['search']) ? '%' . $_GET['search'] . '%' : '%';
        $category = isset($_GET['category']) ? $_GET['category'] : null;

        $sql = "
            SELECT p.*, i.quantity, i.min_stock 
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.name LIKE :search
        ";

        if ($category) {
            $sql .= " AND p.category = :category";
        }

        $sql .= " ORDER BY p.name";

        $stmt = $db->prepare($sql);
        $params = ['search' => $search];

        if ($category) {
            $params['category'] = $category;
        }

        $stmt->execute($params);
        $products = $stmt->fetchAll();

        echo json_encode($products);
    }
}

/**
 * POST - Crear nuevo producto
 */
function handlePost($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['name']) || !isset($data['price'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Nombre y precio son requeridos']);
        return;
    }

    $db->beginTransaction();

    try {
        // Insertar producto
        $stmt = $db->prepare("
            INSERT INTO products (name, description, price, category) 
            VALUES (:name, :description, :price, :category)
        ");

        $stmt->execute([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'price' => $data['price'],
            'category' => $data['category'] ?? null
        ]);

        $productId = $db->lastInsertId();

        // Crear entrada en inventario
        $stmt = $db->prepare("
            INSERT INTO inventory (product_id, quantity, min_stock) 
            VALUES (:product_id, :quantity, :min_stock)
        ");

        $stmt->execute([
            'product_id' => $productId,
            'quantity' => $data['quantity'] ?? 0,
            'min_stock' => $data['min_stock'] ?? 10
        ]);

        $db->commit();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'id' => $productId,
            'message' => 'Producto creado exitosamente'
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

/**
 * PUT - Actualizar producto
 */
function handlePut($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID es requerido']);
        return;
    }

    $db->beginTransaction();

    try {
        // Actualizar producto
        $stmt = $db->prepare("
            UPDATE products 
            SET name = :name, 
                description = :description, 
                price = :price, 
                category = :category
            WHERE id = :id
        ");

        $stmt->execute([
            'id' => $data['id'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'price' => $data['price'],
            'category' => $data['category'] ?? null
        ]);

        // Actualizar inventario si se proporcionan datos
        if (isset($data['quantity']) || isset($data['min_stock'])) {
            $stmt = $db->prepare("
                UPDATE inventory 
                SET quantity = :quantity, 
                    min_stock = :min_stock
                WHERE product_id = :product_id
            ");

            $stmt->execute([
                'product_id' => $data['id'],
                'quantity' => $data['quantity'] ?? 0,
                'min_stock' => $data['min_stock'] ?? 10
            ]);
        }

        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Producto actualizado exitosamente'
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

/**
 * DELETE - Eliminar producto
 */
function handleDelete($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID es requerido']);
        return;
    }

    $stmt = $db->prepare("DELETE FROM products WHERE id = :id");
    $stmt->execute(['id' => $data['id']]);

    if ($stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Producto eliminado exitosamente'
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Producto no encontrado']);
    }
}
?>