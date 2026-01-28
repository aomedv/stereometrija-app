<?php
require_once 'config.php';

$userId = $_SESSION['user_id'] ?? 0;

if ($userId > 0) {
    echo json_encode(['success' => true, 'loggedIn' => true]);
} else {
    echo json_encode(['success' => true, 'loggedIn' => false]);
}