<?php
require_once 'config.php';

$fileId = $_GET['fileId'] ?? 0;
$userId = $_SESSION['user_id'] ?? 0;

if ($userId === 0) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

if (empty($fileId)) {
    echo json_encode(['success' => false, 'message' => 'ID файла обязателен']);
    exit;
}

$stmt = $conn->prepare("SELECT id, name, content, created_at, updated_at FROM files WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $fileId, $userId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Файл не найден']);
    exit;
}

$file = $result->fetch_assoc();

echo json_encode(['success' => true, 'file' => $file]);