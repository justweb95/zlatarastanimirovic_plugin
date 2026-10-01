<?php

namespace ZS\Configurator\Shortcode;

use ZS\Configurator\Data\Compiler;

defined('ABSPATH') || exit;

/**
 * [zs_configurator model="slug"] — the ONLY place frontend assets get enqueued.
 * Prints a mount node with the compiled config inlined so the app boots without
 * a round-trip (REST endpoint stays available for cache revalidation / SPA nav).
 */
final class Configurator
{
    private static ?Configurator $instance = null;
    private bool $enqueued = false;

    public static function instance(): Configurator
    {
        return self::$instance ??= new self();
    }

    /** @param array<string,mixed>|string $atts */
    public function shortcode($atts): string
    {
        $atts = shortcode_atts(['model' => ''], (array) $atts, 'zs_configurator');

        return $this->render(['model' => (string) $atts['model']]);
    }

    /** @param array<string,mixed> $args */
    public function render(array $args): string
    {
        $model = sanitize_key($args['model'] ?? '');
        $this->enqueue();

        $compiled = Compiler::get($model);
        $bootJson = wp_json_encode([
            'restUrl'   => esc_url_raw(rest_url('zs/v1/config')),
            'assetsUrl' => esc_url_raw(ZSC_URL . 'assets/'),
            'model'     => $model,
            'version'   => $compiled['version'],
            'config'    => $compiled['payload'],
        ]);

        $id = 'zs-config-' . wp_generate_uuid4();

        ob_start(); ?>
        <div class="zs-configurator" data-model="<?php echo esc_attr($model); ?>">
            <div id="<?php echo esc_attr($id); ?>" class="zs-config-root" role="application"
                 aria-label="3D konfigurator prstenja">
                <noscript>Za konfigurator je potreban JavaScript.</noscript>
                <div class="zs-config-skeleton" aria-hidden="true"></div>
            </div>
            <script type="application/json" class="zs-config-boot" data-target="<?php echo esc_attr($id); ?>">
                <?php echo $bootJson; // phpcs:ignore — JSON, not HTML ?>
            </script>
        </div>
        <?php echo $this->scene_loader_tags(); // importmap + three.js module, once ?>
        <?php
        return (string) ob_get_clean();
    }

    private function enqueue(): void
    {
        if ($this->enqueued) {
            return;
        }
        $this->enqueued = true;

        $css = ZSC_DIR . 'assets/css/configurator.css';
        $js  = ZSC_DIR . 'assets/js/configurator.js';

        wp_enqueue_style(
            'zs-tokens',
            ZSC_URL . 'assets/css/tokens.css',
            [],
            file_exists(ZSC_DIR . 'assets/css/tokens.css') ? (string) filemtime(ZSC_DIR . 'assets/css/tokens.css') : ZSC_VERSION
        );
        wp_enqueue_style(
            'zs-configurator',
            ZSC_URL . 'assets/css/configurator.css',
            ['zs-tokens'],
            file_exists($css) ? (string) filemtime($css) : ZSC_VERSION
        );

        // Google Fonts: Belleza (display) + Lato (body) — the same pair the live
        // site zlatarastanimirovic.rs uses, so the configurator reads as one
        // brand (design-system.md, decisions.md #49). Belleza ships weight 400.
        wp_enqueue_style(
            'zs-fonts',
            'https://fonts.googleapis.com/css2?family=Belleza&family=Lato:wght@400;700&display=swap',
            [],
            null
        );

        wp_enqueue_script(
            'zs-configurator',
            ZSC_URL . 'assets/js/configurator.js',
            [],
            file_exists($js) ? (string) filemtime($js) : ZSC_VERSION,
            true
        );

        // TEMPORARY live-tuning panel (assets/js/debug-panel.js), only loaded
        // when ?zscdebug=1 is on the URL so normal visitors never see it.
        // Re-enabled 2026-09-10 for the diamond rebuild pass (docs 3d.md
        // "Dijamanti"); comment this back out once the stone numbers are baked
        // into scene.module.js's stoneParams.
        if (isset($_GET['zscdebug'])) { // phpcs:ignore WordPress.Security.NonceVerification -- read-only dev toggle, no state change
            $debugJs = ZSC_DIR . 'assets/js/debug-panel.js';
            wp_enqueue_script(
                'zs-configurator-debug',
                ZSC_URL . 'assets/js/debug-panel.js',
                ['zs-configurator'],
                file_exists($debugJs) ? (string) filemtime($debugJs) : ZSC_VERSION,
                true
            );
        }
    }

    /**
     * three.js scene loader — import map + ES module, emitted inline in the
     * shortcode output (once). Printed by hand rather than via wp_enqueue_script
     * because the import map must precede the module in source order and
     * wp_enqueue_script_module() isn't guaranteed on this WP. Modern Chrome
     * accepts an import map in <body> as long as it comes before the module.
     */
    private function scene_loader_tags(): string
    {
        static $done = false;
        if ($done) {
            return '';
        }
        $done = true;

        $three = ZSC_URL . 'assets/lib/three/';
        // Diamond v2 (decisions #73): scene.module.js imports 'zsc/diamond-kit';
        // mapped here with its own filemtime so an update busts the cache.
        $kitFile = ZSC_DIR . 'assets/js/diamond-kit.js';
        $kitVer  = file_exists($kitFile) ? (string) filemtime($kitFile) : ZSC_VERSION;
        $map = wp_json_encode([
            'imports' => [
                'three'           => $three . 'three.module.min.js',
                'three/addons/'   => $three . 'addons/',
                'zsc/diamond-kit' => ZSC_URL . 'assets/js/diamond-kit.js?ver=' . $kitVer,
            ],
        ], JSON_UNESCAPED_SLASHES);

        $file = ZSC_DIR . 'assets/js/scene.module.js';
        $ver  = file_exists($file) ? (string) filemtime($file) : ZSC_VERSION;

        return sprintf(
            "\n<script type=\"importmap\">%s</script>\n<script type=\"module\" src=\"%s?ver=%s\"></script>\n",
            $map,
            esc_url(ZSC_URL . 'assets/js/scene.module.js'),
            esc_attr($ver)
        );
    }
}
