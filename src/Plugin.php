<?php

namespace ZS\Configurator;

use ZS\Configurator\Admin\Menu;
use ZS\Configurator\Frontend\Template;
use ZS\Configurator\Rest\ConfigController;
use ZS\Configurator\Shortcode\Configurator;

defined('ABSPATH') || exit;

/**
 * Orchestrator. Registers hooks lazily: frontend-only work stays out of admin,
 * admin-only work stays behind is_admin(), REST only on rest_api_init.
 */
final class Plugin
{
    private static ?Plugin $instance = null;

    public static function instance(): Plugin
    {
        return self::$instance ??= new self();
    }

    private function __construct()
    {
    }

    public function boot(): void
    {
        // Shortcode + template tag. The shortcode callback is the ONLY place
        // that enqueues frontend assets (golden rule 1).
        add_shortcode('zs_configurator', [Configurator::instance(), 'shortcode']);

        // Standalone fullscreen page template, registered by the plugin so the
        // configurator page needs no theme markup (no theme coupling).
        Template::instance()->register();

        // REST API: GET /wp-json/zs/v1/config
        add_action('rest_api_init', [new ConfigController(), 'register_routes']);

        if (is_admin()) {
            Menu::instance()->register();
        }

        add_action('init', [$this, 'load_textdomain']);
    }

    public function load_textdomain(): void
    {
        load_plugin_textdomain('zs-configurator', false, dirname(ZSC_BASENAME) . '/languages');
    }

    public static function deactivate(): void
    {
        // Keep data (wp_zs_options, zs_settings) on deactivate; only clear caches.
        Data\Compiler::flush_all();
    }
}
