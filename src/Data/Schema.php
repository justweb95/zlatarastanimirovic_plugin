<?php

namespace ZS\Configurator\Data;

defined('ABSPATH') || exit;

/**
 * Custom table wp_zs_options — enumerable options for the 7 groups.
 * Chosen over a CPT: faster, no ACF, trivial to compile to JSON (see data-model.md).
 */
final class Schema
{
    public const DB_VERSION = '1';
    private const OPTION_KEY = 'zs_db_version';

    public static function table(): string
    {
        global $wpdb;

        return $wpdb->prefix . 'zs_options';
    }

    /** Fired on register_activation_hook. */
    public static function activate(): void
    {
        self::migrate();
        Seeder::run(); // idempotent — only inserts groups that are missing
    }

    /** Safe to call on every load; dbDelta is a no-op when the schema matches. */
    public static function migrate(): void
    {
        if (get_option(self::OPTION_KEY) === self::DB_VERSION) {
            return;
        }

        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $table   = self::table();
        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table} (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            group_key    VARCHAR(32)  NOT NULL DEFAULT '',
            slug         VARCHAR(64)  NOT NULL DEFAULT '',
            label_sr     VARCHAR(191) NOT NULL DEFAULT '',
            sort         INT          NOT NULL DEFAULT 0,
            enabled      TINYINT(1)   NOT NULL DEFAULT 1,
            available    TINYINT(1)   NOT NULL DEFAULT 1,
            stock_qty    INT          NULL,
            price_json   LONGTEXT     NULL,
            params_json  LONGTEXT     NULL,
            compat_json  LONGTEXT     NULL,
            erp_id       VARCHAR(64)  NULL,
            updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY group_key (group_key),
            UNIQUE KEY group_slug (group_key, slug)
        ) {$collate};";

        dbDelta($sql);

        update_option(self::OPTION_KEY, self::DB_VERSION, false);
    }
}
