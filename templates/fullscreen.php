<?php
/**
 * Fullscreen page template — no theme chrome. Just wp_head / content / wp_footer.
 * Used when a page picks the "Konfigurator (bez zaglavlja)" template.
 */

defined('ABSPATH') || exit;

?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <?php wp_head(); ?>
</head>
<body <?php body_class('zs-fullscreen'); ?>>
<?php wp_body_open(); ?>
<main id="zs-main" class="zs-fullscreen-main">
    <?php
    while (have_posts()) {
        the_post();
        the_content();
    }
    ?>
</main>
<?php wp_footer(); ?>
</body>
</html>
