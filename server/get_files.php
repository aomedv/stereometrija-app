<?php
require_once 'config.php';

$userId = $_SESSION['user_id'] ?? 0;

if ($userId === 0) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

$stmt = $conn->prepare("SELECT id, name, created_at, updated_at FROM files WHERE user_id = ? ORDER BY updated_at DESC");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();

$files = [];
while ($row = $result->fetch_assoc()) {
    $files[] = $row;
}

echo json_encode(['success' => true, 'files' => $files]);