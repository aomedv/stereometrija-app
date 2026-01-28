<?php
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);

$userId = $data['userId'] ?? 0;
$code = $data['code'] ?? '';

if (empty($userId) || empty($code)) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

$stmt = $conn->prepare("SELECT id FROM verification_codes WHERE user_id = ? AND code = ?");
$stmt->bind_param("is", $userId, $code);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $stmt = $conn->prepare("UPDATE users SET email_verified = TRUE WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    
    $stmt = $conn->prepare("DELETE FROM verification_codes WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    
    $_SESSION['user_id'] = $userId;
    
    echo json_encode(['success' => true, 'message' => 'Email подтвержден']);
} else {
    echo json_encode(['success' => false, 'message' => 'Неверный код']);
}