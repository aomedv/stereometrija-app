<?php
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);

$email = trim($data['email'] ?? '');
$code = $data['code'] ?? '';

if (empty($email) || empty($code)) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

$stmt = $conn->prepare("SELECT id, attempts, expires_at FROM password_resets WHERE email = ? AND code = ?");
$stmt->bind_param("ss", $email, $code);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt = $conn->prepare("SELECT id, attempts FROM password_resets WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $attemptResult = $stmt->get_result();
    
    if ($attemptResult->num_rows > 0) {
        $resetData = $attemptResult->fetch_assoc();
        $attempts = $resetData['attempts'] + 1;
        
        if ($attempts >= 5) {
            $stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
            $stmt->bind_param("s", $email);
            $stmt->execute();
            echo json_encode(['success' => false, 'message' => 'Превышено количество попыток', 'limit_reached' => true]);
            exit;
        }
        
        $stmt = $conn->prepare("UPDATE password_resets SET attempts = ? WHERE email = ?");
        $stmt->bind_param("is", $attempts, $email);
        $stmt->execute();
    }
    
    echo json_encode(['success' => false, 'message' => 'Неверный код']);
    exit;
}

$resetData = $result->fetch_assoc();

if (strtotime($resetData['expires_at']) < time()) {
    $stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    echo json_encode(['success' => false, 'message' => 'Время истекло', 'expired' => true]);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Код подтвержден']);