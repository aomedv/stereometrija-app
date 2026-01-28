<?php
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);

$userId = $_SESSION['user_id'] ?? 0;
$fileId = $data['fileId'] ?? 0;
$name = trim($data['name'] ?? '');
$content = $data['content'] ?? null;

if ($userId === 0) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

if (empty($fileId)) {
    echo json_encode(['success' => false, 'message' => 'ID файла обязателен']);
    exit;
}

$stmt = $conn->prepare("SELECT id FROM files WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $fileId, $userId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Файл не найден']);
    exit;
}

if (!empty($name) && $content !== null) {
    $stmt = $conn->prepare("UPDATE files SET name = ?, content = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ssii", $name, $content, $fileId, $userId);
} elseif (!empty($name)) {
    $stmt = $conn->prepare("UPDATE files SET name = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param("sii", $name, $fileId, $userId);
} elseif ($content !== null) {
    $stmt = $conn->prepare("UPDATE files SET content = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param("sii", $content, $fileId, $userId);
} else {
    echo json_encode(['success' => false, 'message' => 'Нет данных для обновления']);
    exit;
}

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Файл обновлен']);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка обновления файла']);
}