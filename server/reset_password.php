<?php
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);

$email = trim($data['email'] ?? '');
$code = $data['code'] ?? '';
$newPassword = $data['newPassword'] ?? '';

if (empty($email) || empty($code) || empty($newPassword)) {
    echo json_encode(['success' => false, 'message' => 'Все поля обязательны']);
    exit;
}

if (strlen($newPassword) < 7 || !preg_match('/[0-9]/', $newPassword) || !preg_match('/[a-zA-Z]/', $newPassword)) {
    echo json_encode(['success' => false, 'message' => 'Пароль должен содержать минимум 7 символов, включая цифры и буквы']);
    exit;
}

$stmt = $conn->prepare("SELECT id FROM password_resets WHERE email = ? AND code = ?");
$stmt->bind_param("ss", $email, $code);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Неверные данные']);
    exit;
}

$hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

$stmt = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
$stmt->bind_param("ss", $hashedPassword, $email);
$stmt->execute();

$stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$userResult = $stmt->get_result();
$user = $userResult->fetch_assoc();
if (!$user['email_verified']) {
    $stmt = $conn->prepare("UPDATE users SET email_verified = 1 WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
}

$_SESSION['user_id'] = $user['id'];

echo json_encode(['success' => true, 'message' => 'Пароль успешно изменен']);