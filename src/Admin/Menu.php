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
    }

    public function add_page(): void
    {
        $this->hook = (string) add_menu_page(
            'Konfigurator',
            'Konfigurator',
            'manage_options',
            self::SLUG,
            [Screen::class, 'render'],
            'dashicons-marker',
            58
        );
    }

    public function handle_post(): void
    {
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
        wp_enqueue_style(
            'zs-admin',
            ZSC_URL . 'assets/css/admin.css',
            [],
            file_exists(ZSC_DIR . 'assets/css/admin.css') ? (string) filemtime(ZSC_DIR . 'assets/css/admin.css') : ZSC_VERSION
        );
    }
}
