<?php
/**
 * Plugin Name: OrWebCraft BirdNET Release Installer
 * Description: Installs the tested multilingual analyzer with a verified backup and one-click rollback. Activation alone changes no analyzer files.
 * Version: 1.0.0
 * Requires PHP: 7.4
 * License: MIT
 */
if (!defined('ABSPATH')) { exit; }

final class Orwebcraft_Birdnet_Release {
    const OPTION = 'orwebcraft_birdnet_release_20261015';
    const RELEASE = '391739c97cdadbb90eca6c6c19e8880a02674529';

    public static function boot() {
        add_action('admin_menu', function () {
            add_management_page('BirdNET Release', 'BirdNET Release', 'update_plugins', 'orwebcraft-birdnet-release', array(__CLASS__, 'page'));
        });
        add_action('admin_post_orwebcraft_birdnet_release', array(__CLASS__, 'handle'));
    }

    private static function require_access() {
        if (!current_user_can('update_plugins')) { throw new RuntimeException('You need permission to update plugins.'); }
    }

    private static function target() {
        $base = realpath(WP_PLUGIN_DIR);
        $target = WP_PLUGIN_DIR . '/orwebcraft-birdnet-fixed';
        if (!$base || is_link($target) || realpath($target) !== $base . DIRECTORY_SEPARATOR . 'orwebcraft-birdnet-fixed') {
            throw new RuntimeException('The existing orwebcraft-birdnet-fixed plugin directory could not be verified. Nothing changed.');
        }
        return $target;
    }

    public static function inventory($root) {
        if (!is_dir($root) || is_link($root)) { throw new RuntimeException('Expected a normal analyzer directory.'); }
        $result = array();
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isLink() || !$file->isFile()) { throw new RuntimeException('Unexpected link or special file; operation stopped.'); }
            $rel = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));
            $hash = hash_file('sha256', $file->getPathname());
            if (!$hash) { throw new RuntimeException('Cannot verify analyzer file: ' . $rel); }
            $result[$rel] = $hash;
        }
        ksort($result);
        if (!isset($result['index.html'])) { throw new RuntimeException('The analyzer index.html is missing.'); }
        return $result;
    }

    private static function verify($root, $expected) {
        if (self::inventory($root) !== $expected) { throw new RuntimeException('File integrity check failed. Nothing was switched.'); }
    }

    private static function copy_release($source, $stage, $files) {
        if (file_exists($stage) || !mkdir($stage, 0755)) { throw new RuntimeException('Cannot create a fresh staging directory.'); }
        foreach ($files as $rel => $hash) {
            if (!preg_match('~^[A-Za-z0-9_./-]+$~D', $rel) || strpos($rel, '..') !== false || $rel[0] === '/') {
                throw new RuntimeException('Invalid release path.');
            }
            $destination = $stage . '/' . $rel;
            if (!is_dir(dirname($destination)) && !mkdir(dirname($destination), 0755, true)) { throw new RuntimeException('Cannot create staging subdirectory.'); }
            if (!copy($source . '/' . $rel, $destination) || !chmod($destination, 0644)) { throw new RuntimeException('Cannot stage release file: ' . $rel); }
        }
        self::verify($stage, $files);
    }

    // Used for installation and rollback. If the second rename fails, restore the
    // original directory before reporting failure. Neither tree is deleted.
    public static function swap($active, $replacement, $preserve) {
        if (file_exists($preserve) || is_link($active) || is_link($replacement)) { throw new RuntimeException('Unsafe or occupied swap path.'); }
        if (!rename($active, $preserve)) { throw new RuntimeException('Cannot preserve the existing analyzer. Nothing changed.'); }
        if (!@rename($replacement, $active)) {
            if (!@rename($preserve, $active)) { throw new RuntimeException('Restore needed: rename the preserved analyzer directory back to app using hosting support. No files were deleted.'); }
            throw new RuntimeException('Switch failed; the previous analyzer was restored automatically.');
        }
    }

    public static function install() {
        self::require_access();
        $target = self::target();
        if (get_option(self::OPTION)) { throw new RuntimeException('A release record already exists. Use rollback rather than installing again.'); }
        $app = $target . '/app';
        $original = self::inventory($app);
        $manifest = json_decode(file_get_contents(__DIR__ . '/release.json'), true);
        if (!is_array($manifest) || $manifest['commit'] !== self::RELEASE || !is_array($manifest['files'])) { throw new RuntimeException('Invalid release manifest.'); }
        $files = $manifest['files']; ksort($files);
        self::verify(__DIR__ . '/payload', $files);
        $token = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));
        $backup = 'app-backup-' . $token;
        $stage = 'app-stage-' . $token;
        $state = array('status' => 'prepared', 'backup' => $backup, 'stage' => $stage, 'original' => $original, 'release' => $files, 'commit' => self::RELEASE);
        self::copy_release(__DIR__ . '/payload', $target . '/' . $stage, $files);
        self::verify($app, $original);
        // Persist recovery information BEFORE any changes to the active app.
        if (!add_option(self::OPTION, $state, '', false)) { throw new RuntimeException('Cannot save recovery information. Nothing changed.'); }
        self::swap($app, $target . '/' . $stage, $target . '/' . $backup);
        $state['status'] = 'installed';
        update_option(self::OPTION, $state, false);
        return 'Release installed. The complete original app is preserved as ' . $backup . '. Open the analyzer, refresh, and test languages. Rollback remains available below.';
    }

    public static function rollback() {
        self::require_access();
        $target = self::target(); $state = get_option(self::OPTION);
        if (!is_array($state) || empty($state['backup']) || !preg_match('/^app-backup-[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$/D', $state['backup'])) { throw new RuntimeException('No verified backup record is available.'); }
        if ($state['status'] === 'rolled-back') { throw new RuntimeException('Rollback has already completed.'); }
        $backup = $target . '/' . $state['backup'];
        self::verify($backup, $state['original']);
        // Refuse to discard unexpected edits made since installation.
        self::verify($target . '/app', $state['release']);
        $preserve = 'app-retired-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));
        self::swap($target . '/app', $backup, $target . '/' . $preserve);
        $state['status'] = 'rolled-back'; $state['retired'] = $preserve;
        update_option(self::OPTION, $state, false);
        return 'Original analyzer restored. The multilingual release is preserved as ' . $preserve . '. Refresh the analyzer and close/reopen its tabs so browser caches update.';
    }

    public static function handle() {
        try {
            self::require_access();
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') { throw new RuntimeException('Use the action buttons on the release page.'); }
            check_admin_referer('orwebcraft_birdnet_release');
            $target = self::target();
            $lock = fopen($target . '/.birdnet-release.lock', 'c');
            if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) { throw new RuntimeException('Another release operation is running. Try again after it finishes.'); }
            try {
                $action = isset($_POST['release_action']) ? $_POST['release_action'] : '';
                if ($action === 'install') { $message = self::install(); }
                elseif ($action === 'rollback') { $message = self::rollback(); }
                else { throw new RuntimeException('Unknown release action.'); }
            } finally { flock($lock, LOCK_UN); fclose($lock); }
            update_option(self::OPTION . '_notice', $message, false);
        } catch (Throwable $error) { update_option(self::OPTION . '_notice', 'Stopped: ' . $error->getMessage(), false); }
        wp_safe_redirect(admin_url('tools.php?page=orwebcraft-birdnet-release')); exit;
    }

    public static function page() {
        if (!current_user_can('update_plugins')) { return; }
        $state = get_option(self::OPTION); $notice = get_option(self::OPTION . '_notice');
        echo '<div class="wrap"><h1>BirdNET multilingual release</h1>';
        echo '<p>English, Hebrew and Arabic UI, searchable language selection and multilingual species details. Release: <code>' . esc_html(self::RELEASE) . '</code>.</p>';
        echo '<p>This installer only replaces <code>orwebcraft-birdnet-fixed/app</code>. It preserves the original app in a timestamped sibling folder. It does not change the existing plugin PHP, WordPress pages, map, accounts or settings. Activation alone does not publish the analyzer.</p>';
        if ($notice) { echo '<div class="notice notice-info"><p>' . esc_html($notice) . '</p></div>'; }
        echo '<p>Status: <strong>' . esc_html($state ? $state['status'] : 'Not installed') . '</strong></p>';
        if ($state && isset($state['backup'])) { echo '<p>Original backup: <code>' . esc_html($state['backup']) . '</code>. Keep this installer for rollback. No backup files are deleted automatically.</p>'; }
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('orwebcraft_birdnet_release');
        echo '<input type="hidden" name="action" value="orwebcraft_birdnet_release">';
        if (!$state) { echo '<button class="button button-primary" name="release_action" value="install">Back up and install tested release</button>'; }
        elseif ($state['status'] !== 'rolled-back') { echo '<button class="button" name="release_action" value="rollback">Restore original analyzer</button>'; }
        echo '</form><p>Backups are static analyzer assets on the same server. Rollback restores the complete original directory; browser service-worker caches may need a reload or closing and reopening the analyzer tab. If a staged operation stops, keep all folders and contact the person performing the release.</p></div>';
    }
}
Orwebcraft_Birdnet_Release::boot();
