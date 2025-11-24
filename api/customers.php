<?php
/**
 * API REST para Gestión de Clientes
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
 * GET - Obtener clientes
 */
function handleGet($db)
{
    if (isset($_GET['id'])) {
        // Obtener cliente específico
        $stmt = $db->prepare("SELECT * FROM customers WHERE id = :id");
        $stmt->execute(['id' => $_GET['id']]);
        $customer = $stmt->fetch();

        if ($customer) {
            echo json_encode($customer);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Cliente no encontrado']);
        }
    } else {
        // Obtener todos los clientes
        $search = isset($_GET['search']) ? '%' . $_GET['search'] . '%' : '%';

        $stmt = $db->prepare("
            SELECT * FROM customers 
            WHERE name LIKE :search 
               OR email LIKE :search
               OR phone LIKE :search
            ORDER BY name
        ");

        $stmt->execute(['search' => $search]);
        $customers = $stmt->fetchAll();

        echo json_encode($customers);
    }
}

/**
 * POST - Crear nuevo cliente
 */
function handlePost($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Nombre es requerido']);
        return;
    }

    $stmt = $db->prepare("
        INSERT INTO customers (name, email, phone, address, tax_id) 
        VALUES (:name, :email, :phone, :address, :tax_id)
    ");

    $stmt->execute([
        'name' => $data['name'],
        'email' => $data['email'] ?? null,
        'phone' => $data['phone'] ?? null,
        'address' => $data['address'] ?? null,
        'tax_id' => $data['tax_id'] ?? null
    ]);

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'id' => $db->lastInsertId(),
        'message' => 'Cliente creado exitosamente'
    ]);
}

/**
 * PUT - Actualizar cliente
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
        UPDATE customers 
        SET name = :name, 
            email = :email, 
            phone = :phone, 
            address = :address,
            tax_id = :tax_id
        WHERE id = :id
    ");

    $stmt->execute([
        'id' => $data['id'],
        'name' => $data['name'],
        'email' => $data['email'] ?? null,
        'phone' => $data['phone'] ?? null,
        'address' => $data['address'] ?? null,
        'tax_id' => $data['tax_id'] ?? null
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Cliente actualizado exitosamente'
    ]);
}

/**
 * DELETE - Eliminar cliente
 */
function handleDelete($db)
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID es requerido']);
        return;
    }

    // Verificar si el cliente tiene facturas
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM invoices WHERE customer_id = :id");
    $stmt->execute(['id' => $data['id']]);
    $result = $stmt->fetch();

    if ($result['count'] > 0) {
        http_response_code(409);
        echo json_encode([
            'error' => 'No se puede eliminar el cliente porque tiene facturas asociadas'
        ]);
        return;
    }

    $stmt = $db->prepare("DELETE FROM customers WHERE id = :id");
    $stmt->execute(['id' => $data['id']]);

    if ($stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Cliente eliminado exitosamente'
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Cliente no encontrado']);
    }
}
?>