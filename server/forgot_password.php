<?php
require_once 'config.php';
require_once 'send_email.php';

$data = json_decode(file_get_contents('php://input'), true);

$email = trim($data['email'] ?? '');

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'Email обязателен']);
    exit;
}

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Email не найден']);
    exit;
}

$code = str_pad(rand(0, 99999999), 8, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', strtotime('+90 minutes'));

$stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();

$stmt = $conn->prepare("INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $email, $code, $expiresAt);
$stmt->execute();

$code_str = (string) $code;
$length = strlen($code_str);
$half = $length / 2;
$first = substr($code_str, 0, $half);
$second = substr($code_str, $half);
$subject = "Восстановление пароля";

$body = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$subject</title>
<style>
    * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    }
    body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
</style>
</head>
<body style="background-color: white; padding: 8px; color: #4b5563; font-family: sans-serif; display: flex; justify-content: center; align-items: center;">
<table style="margin: 0; padding: 0; width: 100%; height: 100%;" cellspacing="0" cellpadding="0">
    <tr>
    <td align="center" style="background-color: white;">
        <table style="max-width: 672px; width: 100%; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden;" cellspacing="0" cellpadding="0">
        <tr>
            <td style="background-color: #667eea; text-align: center; padding: 16px;">
            <h1 style="font-size: 24px; font-weight: bold; color: white; margin: 0;">PlainStereo</h1>
            </td>
        </tr>
        <tr>
            <td style="padding: 24px;">
            <p style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Ваш код для восстановления пароля</p>
            <p style="color: #4b5563; font-size: 14px; margin-bottom: 24px;">
                Введите этот код, чтобы завершить процесс:
            </p>
            <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 24px; font-size: 60px; font-weight: 600;">
                <span style="color: #1f2937;">$first</span>
                <span style="color: #9ca3af;">-</span>
                <span style="color: #1f2937;">$second</span>
            </div>
            </td>
        </tr>
        <tr>
            <td style="background-color: #f3f4f6; padding: 24px; color: #4b5563; text-align: center; font-size: 14px;">
            Если вы не отправляли этот запрос, проигнорируйте это письмо
            </td>
        </tr>
        </table>
    </td>
    </tr>
</table>
</body>
</html>
HTML;
$altBody = "Ваш код: " . $code;

sendEmail($email, $subject, $body, $altBody);

echo json_encode(['success' => true, 'message' => 'Код отправлен на email']);