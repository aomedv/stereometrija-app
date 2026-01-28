<?php
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);

$userId = $_SESSION['user_id'] ?? 0;
$name = trim($data['name'] ?? '');

if ($userId === 0) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

if (empty($name)) {
    echo json_encode(['success' => false, 'message' => 'Название файла обязательно']);
    exit;
}

$stmt = $conn->prepare("INSERT INTO files (user_id, name, content) VALUES (?, ?, '')");
$stmt->bind_param("is", $userId, $name);

if ($stmt->execute()) {
    $fileId = $conn->insert_id;
    echo json_encode(['success' => true, 'fileId' => $fileId, 'message' => 'Файл создан']);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка создания файла']);
}