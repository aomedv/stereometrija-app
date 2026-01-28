<?php
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);

$userId = $_SESSION['user_id'] ?? 0;
$fileId = $data['fileId'] ?? 0;

if ($userId === 0) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

if (empty($fileId)) {
    echo json_encode(['success' => false, 'message' => 'ID файла обязателен']);
    exit;
}

$stmt = $conn->prepare("DELETE FROM files WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $fileId, $userId);

if ($stmt->execute() && $stmt->affected_rows > 0) {
    echo json_encode(['success' => true, 'message' => 'Файл удален']);
} else {
    echo json_encode(['success' => false, 'message' => 'Файл не найден или ошибка удаления']);
}