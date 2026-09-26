<?php
declare(strict_types=1);
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') { http_response_code(403); exit('Enable HTTPS to use the editor.'); }
if (!is_file(__DIR__ . '/auth.php')) { header('Location: setup.php'); exit; }
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'Strict');
session_start();
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(24)); }
$error = ''; $success = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) $error = 'Please reload and try again.';
    elseif (password_verify((string)($_POST['password'] ?? ''), require __DIR__ . '/auth.php')) { session_regenerate_id(true); $_SESSION['editor'] = true; }
    else { sleep(1); $error = 'Incorrect password.'; }
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'logout') {
    if (hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) { $_SESSION = []; session_destroy(); header('Location: editor.php'); exit; }
}
if (empty($_SESSION['editor'])): ?>
<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeliverCrew editor sign in</title><link rel="stylesheet" href="assets/editor.css"><main><h1>Content editor</h1><p>Sign in to update DeliverCrew website wording.</p><?php if ($error): ?><p class="error" role="alert"><?= h($error) ?></p><?php endif; ?><form method="post"><input type="hidden" name="action" value="login"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><label>Password <input type="password" name="password" autocomplete="current-password" required></label><button>Sign in</button></form></main></html><?php exit; endif;
$file = __DIR__ . '/data/content.json';
$pages = ['home'=>'Home','distribution'=>'Leaflet distribution','print'=>'Design & print','branding'=>'Branding & signage','websites'=>'Websites & marketing','gps'=>'GPS tracking','shared'=>'Shared contact & footer','pricing'=>'Distribution prices'];
$page = (string)($_GET['page'] ?? $_POST['page'] ?? 'home'); if (!isset($pages[$page])) $page = 'home';
$content = json_decode((string)file_get_contents($file), true);
if (!is_array($content)) { http_response_code(500); exit('Content file could not be read.'); }
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save') {
    if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) $error = 'Your session expired. Reload the editor and try again.';
    else {
        $updated = [];
        foreach ($content[$page] as $key => $old) {
            $value = trim((string)($_POST[$key] ?? ''));
            if (strlen($value) > 3000) { $error = 'Keep each field under 3,000 characters.'; break; }
            if ($key === 'email' && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) { $error = 'Enter a valid email address.'; break; }
            if ($key === 'phone' && $value !== '' && !preg_match('/^[+() 0-9-]{7,30}$/', $value)) { $error = 'Enter a valid phone number.'; break; }
            $updated[$key] = $value;
        }
        if (!$error) {
            $lock = @fopen(__DIR__ . '/data/content.lock', 'c');
            if (!$lock || !flock($lock, LOCK_EX)) $error = 'Could not lock the content file. Check folder permissions.';
            else {
                $latest = json_decode((string)file_get_contents($file), true);
                if (!is_array($latest)) $error = 'Content file could not be read.';
                elseif (!hash_equals((string)($_POST['version'] ?? ''), hash('sha256', json_encode($latest[$page])))) $error = 'Someone else changed this page. Reload it before saving.';
                else {
                    $latest[$page] = $updated;
                    $json = json_encode($latest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    $tmp = tempnam(__DIR__ . '/data', 'save-');
                    if (!$tmp || $json === false || file_put_contents($tmp, $json . "\n") === false || !rename($tmp, $file)) $error = 'Could not save. Check data folder permissions.';
                    else { $content = $latest; $success = 'Saved. The public pages will show the new wording.'; }
                }
                flock($lock, LOCK_UN); fclose($lock);
            }
        }
    }
}
$labels = ['shared_1000'=>'Shared — 1,000 leaflets','solus_1000'=>'Solus — 1,000 leaflets','shared_2500'=>'Shared — 2,500 leaflets','solus_2500'=>'Solus — 2,500 leaflets','shared_5000'=>'Shared — 5,000 leaflets','solus_5000'=>'Solus — 5,000 leaflets','shared_10000'=>'Shared — 10,000 leaflets','solus_10000'=>'Solus — 10,000 leaflets','shared_20000'=>'Shared — 20,000 leaflets','solus_20000'=>'Solus — 20,000 leaflets','eyebrow'=>'Small heading','title'=>'Page headline','intro'=>'Introduction','detail'=>'Main text','contact_title'=>'Contact heading','contact_intro'=>'Contact introduction','contact_status'=>'Contact status (shown if email and phone are blank)','email'=>'Public email','phone'=>'Public phone','footer'=>'Footer sentence'];
$version = hash('sha256', json_encode($content[$page]));
?><!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeliverCrew content editor</title><link rel="stylesheet" href="assets/editor.css"><main><div class="top"><h1>Content editor</h1><form method="post"><input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><button>Sign out</button></form></div><p><a href="index.html" target="_blank" rel="noopener">View website ↗</a></p><nav class="tabs" aria-label="Choose page"><?php foreach ($pages as $id=>$name): ?><a class="<?= $id === $page ? 'active' : '' ?>" href="?page=<?= h($id) ?>"><?= h($name) ?></a><?php endforeach; ?></nav><h2><?= h($pages[$page]) ?></h2><?php if ($error): ?><p class="error" role="alert"><?= h($error) ?></p><?php endif; ?><?php if ($success): ?><p class="success" role="status"><?= h($success) ?></p><?php endif; ?><form method="post"><input type="hidden" name="action" value="save"><input type="hidden" name="page" value="<?= h($page) ?>"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="version" value="<?= h($version) ?>"><?php foreach ($content[$page] as $key=>$value): ?><label for="field-<?= h($key) ?>"><?= h($labels[$key] ?? $key) ?></label><?php if (in_array($key,['intro','detail','contact_intro','contact_status'],true)): ?><textarea id="field-<?= h($key) ?>" name="<?= h($key) ?>" maxlength="3000"><?= h((string)$value) ?></textarea><?php else: ?><input id="field-<?= h($key) ?>" name="<?= h($key) ?>" value="<?= h((string)$value) ?>" maxlength="3000"><?php endif; ?><?php endforeach; ?><p class="hint">Plain text only. Save each page separately.</p><button>Save to website</button></form></main></html>
