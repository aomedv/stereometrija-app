<?php
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);

$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Все поля обязательны']);
    exit;
}

$stmt = $conn->prepare("SELECT id, password, email_verified FROM users WHERE username = ? OR email = ?");
$stmt->bind_param("ss", $username, $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Неверный логин/email или пароль']);
    exit;
}

$user = $result->fetch_assoc();

if (!password_verify($password, $user['password'])) {
    echo json_encode(['success' => false, 'message' => 'Неверный логин/email или пароль']);
    exit;
}

if (!$user['email_verified']) {
    echo json_encode(['success' => false, 'message' => 'Email не подтвержден. Восстановите аккаунт для подтверждения email']);
    exit;
}

$_SESSION['user_id'] = $user['id'];

echo json_encode(['success' => true, 'message' => 'Успешный вход']);