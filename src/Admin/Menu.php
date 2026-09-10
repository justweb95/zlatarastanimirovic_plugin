<?php

namespace ZS\Configurator\Admin;

defined('ABSPATH') || exit;

/**
 * Top-level admin menu "Konfigurator". Admin assets load ONLY on this screen
 * (golden rule 1). All POST handling is dispatched from here before any output.
 */
final class Menu
{
    private static ?Menu $instance = null;
    public const SLUG = 'zs-configurator';
    private string $hook = '';

    public static function instance(): Menu
    {
        return self::$instance ??= new self();
    }

    public function register(): void
    {
        add_action('admin_menu', [$this, 'add_page']);
        add_action('admin_init', [$this, 'handle_post']);
        add_action('admin_enqueue_scripts', [$this, 'assets']);
        // Inline (no-reload) editing of the Opcije tab — admin.js posts the
        // same forms here instead of a full submit, and only the touched
        // group re-renders (client, 2026-09-10). Plain POST still works.
        add_action('wp_ajax_zs_admin', [Screen::class, 'ajax']);
    }

    public function add_page(): void
    {
        // Menu icon: a small inline diamond SVG (data URI — WordPress sizes it
        // to 20px and recolours it with the admin-menu filter, so a raster
        // logo isn't used here). The full logo lives in the screen header.
        $icon = 'data:image/svg+xml;base64,' . base64_encode(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">'
            . '<path fill="#a7aaad" d="M6 1.6h8l4.4 5.2L10 18.4 1.6 6.8zM6.8 3 3.8 6.5h4.1zm6.4 0-1.1 3.5h4.1zM8.7 3l-1.2 3.5h5L11.3 3zM3.5 7.9l4.6 6.6-2.7-6.6zm4.1 0L10 15.2l2.4-7.3zm6.7 0-2.7 6.6 4.6-6.6z"/>'
            . '</svg>'
        );

        $this->hook = (string) add_menu_page(
            'Konfigurator',
            'Konfigurator',
            'manage_options',
            self::SLUG,
            [Screen::class, 'render'],
            $icon,
            58
        );
    }

    public function handle_post(): void
    {
        // admin_init also fires on admin-ajax.php — let wp_ajax_zs_admin handle
        // those (Screen::ajax); this branch is the plain-POST / no-JS path only.
        if (wp_doing_ajax()) {
            return;
        }
        if (!is_admin() || empty($_POST['zs_action']) || !current_user_can('manage_options')) {
            return;
        }
        check_admin_referer('zs_admin');
        Screen::dispatch(sanitize_key(wp_unslash($_POST['zs_action'])));
    }

    public function assets(string $hook): void
    {
        if ($hook !== $this->hook) {
            return;
        }
        // Brand fonts (same pair as the live site + the configurator front end:
        // Belleza display, Lato body — decisions #49). Admin screen only.
        wp_enqueue_style(
            'zs-admin-fonts',
            'https://fonts.googleapis.com/css2?family=Belleza&family=Lato:wght@400;700&display=swap',
            [],
            null
        );
        wp_enqueue_style(
            'zs-admin',
            ZSC_URL . 'assets/css/admin.css',
            ['zs-admin-fonts'],
            file_exists(ZSC_DIR . 'assets/css/admin.css') ? (string) filemtime(ZSC_DIR . 'assets/css/admin.css') : ZSC_VERSION
        );

        $adminJs = ZSC_DIR . 'assets/js/admin.js';
        wp_enqueue_script(
            'zs-admin',
            ZSC_URL . 'assets/js/admin.js',
            [],
            file_exists($adminJs) ? (string) filemtime($adminJs) : ZSC_VERSION,
            true
        );
        wp_localize_script('zs-admin', 'ZS_ADMIN', [
            'ajax'  => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('zs_admin'),
        ]);
    }
}
