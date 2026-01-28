<?php
header('Content-Type: text/html; charset=utf-8');

$dbHost = 'localhost';
$dbUser = 'root';
$dbPass = '';
$dbName = 'stereometrija_db';

$conn = new mysqli($dbHost, $dbUser, $dbPass);

if ($conn->connect_error) {
    die($conn->connect_error);
}

$conn->query("CREATE DATABASE IF NOT EXISTS " . $dbName);
$conn->select_db($dbName);

$tables = [
    "users" => "CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    
    "verification_codes" => "CREATE TABLE IF NOT EXISTS verification_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        code VARCHAR(6) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )",
    
    "password_resets" => "CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        code VARCHAR(8) NOT NULL,
        attempts INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
    )",
    
    "files" => "CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name VARCHAR(255) NOT NULL,
        content LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )"
];

echo "<h1>Установка базы данных Stereometrija</h1>";
echo "<p>База данных: <strong>$dbName</strong></p>";
echo "<hr>";

foreach ($tables as $tableName => $sql) {
    if ($conn->query($sql)) {
        echo "<p style='color: green;'>✓ Таблица '$tableName' создана успешно</p>";
    } else {
        echo "<p style='color: red;'>✗ Ошибка создания таблицы '$tableName': " . $conn->error . "</p>";
    }
}

echo "<hr>";
echo "<p><strong>Установка завершена!</strong></p>";
echo "<p>Вы можете закрыть эту страницу и перейти к <a href='../auth.html'>auth.html</a></p>";

$conn->close();