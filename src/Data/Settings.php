<?php

namespace ZS\Configurator\Data;

defined('ABSPATH') || exit;

/**
 * Global settings — a single wp_option holding JSON (see data-model.md).
 * Metal spot prices, HDRI URL, CDN base, inquiry recipients, ERPNext creds (stub).
 */
final class Settings
{
    private const KEY = 'zs_settings';

    /** @return array<string,mixed> */
    public static function defaults(): array
    {
        return [
            'currency'        => 'RSD',
            'cdn_base'        => '',
            'hdri_url'        => '',
            'inquiry_emails'  => get_option('admin_email'),
            // Metal spot price per gram (RSD), by purity key. Manual now, ERPNext later.
            'spot_prices'     => [
                'au_14k' => 0,
                'au_18k' => 0,
                'pt_950' => 0,
                'pd_950' => 0,
            ],
            // ERPNext — stub, Tab 1. Not used yet.
            'erp_url'         => '',
            'erp_api_key'     => '',
            'erp_api_secret'  => '',
        ];
    }

    /** @return array<string,mixed> */
    public static function all(): array
    {
        $stored = get_option(self::KEY, []);

        return array_merge(self::defaults(), is_array($stored) ? $stored : []);
    }

    public static function get(string $key, mixed $fallback = null): mixed
    {
        return self::all()[$key] ?? $fallback;
    }

    /** @param array<string,mixed> $values */
    public static function update(array $values): void
    {
        $current = self::all();
        update_option(self::KEY, array_merge($current, $values), false);
        Compiler::flush_all();
    }
}
