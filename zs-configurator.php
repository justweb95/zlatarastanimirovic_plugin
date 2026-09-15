<?php
/**
 * Plugin Name:       ZS Configurator
 * Plugin URI:        https://github.com/justweb95/zs-configurator
 * Description:        Premium real-time 3D ring configurator for Zlatara Stanimirović. Standalone, theme-independent. Mount via [zs_configurator] shortcode.
 * Version:           0.6.10
 * Requires at least: 6.0
 * Requires PHP:      8.1
 * Author:            justweb
 * License:           GPL-2.0-or-later
 * Text Domain:       zs-configurator
 *
 * Golden rules (see CLAUDE.md): lightweight (frontend assets only on the shortcode page),
 * premium feel, real-time WebGL, single standalone plugin, no Gutenberg block, Serbian UI.
 */

defined('ABSPATH') || exit;

define('ZSC_VERSION', '0.6.10');
define('ZSC_FILE', __FILE__);
define('ZSC_DIR', plugin_dir_path(__FILE__));
define('ZSC_URL', plugin_dir_url(__FILE__));
define('ZSC_BASENAME', plugin_basename(__FILE__));

/**
 * Tiny PSR-4 autoloader for ZS\Configurator\* → src/*.php.
 * No Composer: keeps the plugin dependency-free per golden rule 1.
 */
spl_autoload_register(static function (string $class): void {
    $prefix = 'ZS\\Configurator\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $path = ZSC_DIR . 'src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

register_activation_hook(__FILE__, [\ZS\Configurator\Data\Schema::class, 'activate']);
register_deactivation_hook(__FILE__, [\ZS\Configurator\Plugin::class, 'deactivate']);

add_action('plugins_loaded', static function (): void {
    \ZS\Configurator\Plugin::instance()->boot();
});

/**
 * Template tag: render the configurator from PHP (alternative to the shortcode).
 *
 * @param array<string,mixed> $args e.g. ['model' => 'aurora-solitaire']
 */
function zs_configurator_render(array $args = []): string
{
    return \ZS\Configurator\Shortcode\Configurator::instance()->render($args);
}
