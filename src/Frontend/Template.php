<?php

namespace ZS\Configurator\Frontend;

defined('ABSPATH') || exit;

/**
 * Registers a "Konfigurator (fullscreen)" page template from the plugin itself,
 * so the configurator page carries no theme header/footer and the plugin stays
 * theme-independent. Selectable in the page editor's Template dropdown.
 */
final class Template
{
    private static ?Template $instance = null;
    private const SLUG = 'zs-configurator-fullscreen';

    public static function instance(): Template
    {
        return self::$instance ??= new self();
    }

    public function register(): void
    {
        add_filter('theme_page_templates', [$this, 'add_choice']);
        add_filter('template_include', [$this, 'maybe_use']);
        // On the fullscreen template, suppress the active theme's own CSS/JS so
        // its reset / layout can't fight the configurator. Timing-independent:
        // filters the tag at print time, matched by the theme URL (no handles).
        add_filter('style_loader_src', [$this, 'block_theme_src'], 10, 1);
        add_filter('script_loader_src', [$this, 'block_theme_src'], 10, 1);
    }

    public function block_theme_src(string $src): string
    {
        if (!$src || is_admin() || !$this->is_active()) {
            return $src;
        }

        return str_starts_with($src, trailingslashit(get_stylesheet_directory_uri())) ? '' : $src;
    }

    private function is_active(): bool
    {
        return is_page()
            && (string) get_post_meta(get_queried_object_id(), '_wp_page_template', true) === self::SLUG;
    }

    /** @param array<string,string> $templates */
    public function add_choice(array $templates): array
    {
        $templates[self::SLUG] = 'Konfigurator (bez zaglavlja)';

        return $templates;
    }

    public function maybe_use(string $template): string
    {
        if (!is_page()) {
            return $template;
        }
        $chosen = (string) get_post_meta(get_queried_object_id(), '_wp_page_template', true);
        if ($chosen !== self::SLUG) {
            return $template;
        }
        $own = ZSC_DIR . 'templates/fullscreen.php';

        return is_file($own) ? $own : $template;
    }
}
