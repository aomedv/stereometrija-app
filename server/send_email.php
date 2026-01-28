<?php
require 'src/PHPMailer.php';
require 'src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;

function sendEmail($to, $subject, $body, $altBody) {
    $mail = new PHPMailer(true);
    $mail->CharSet = 'UTF-8';
    $mail->isSMTP();
    $mail->Host = '';
    $mail->SMTPAuth = true;
    $mail->Username = '';
    $mail->Password = '';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;
    
    $mail->setFrom('a@a.a', '');
    $mail->addAddress($to);
    $mail->Subject = $subject;

    $mail->isHTML(true);
    $mail->Body = $body;
    $mail->AltBody = $altBody;
    
    return $mail->send();
}