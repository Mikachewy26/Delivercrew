<?php
declare(strict_types=1);
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (file_exists(__DIR__ . '/auth.php')) { http_response_code(404); exit('Setup complete. Open editor.php.'); }
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') { http_response_code(403); exit('Enable HTTPS before setup.'); }
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $key = (string)($_POST['key'] ?? ''); $password = (string)($_POST['password'] ?? '');
    if (!hash_equals("15e6c1201d2178ed8f6ba416d7d513d6a893a877bcf83e219cbce81413ed799c", hash('sha256', $key))) $error = 'Incorrect setup key.';
    elseif (strlen($password) < 12 || strlen($password) > 200) $error = 'Choose a password of 12 to 200 characters.';
    else {
        $file = __DIR__ . '/auth.php';
        $contents = '<?php return ' . var_export(password_hash($password, PASSWORD_DEFAULT), true) . ';';
        $handle = @fopen($file, 'x');
        if (!$handle) $error = 'Could not create editor credentials. Check file permissions or whether setup is complete.';
        else { fwrite($handle, $contents); fclose($handle); chmod($file, 0600); header('Location: editor.php'); exit; }
    }
}
?><!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeliverCrew editor setup</title><link rel="stylesheet" href="assets/editor.css"><main><h1>Set up your editor</h1><p>Use HTTPS and enter your private setup key. Choose a password you can keep safely.</p><?php if ($error): ?><p role="alert" class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?><form method="post"><label>Setup key <input name="key" required autocomplete="off"></label><label>New editor password <input type="password" name="password" required minlength="12" autocomplete="new-password"></label><button>Activate editor</button></form></main></html>
