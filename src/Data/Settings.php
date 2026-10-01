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
            // Metal price per gram (RSD), by purity key — entered MANUALLY by the
            // admin (Podešavanja tab). The only source of truth for the price; no
            // spot/online feed (decisions #77). Key name kept for compatibility.
            'spot_prices'     => [
                'au_14k' => 0,
                'au_18k' => 0,
                'au_22k' => 0,
                'au_24k' => 0,
                'pt_950' => 0,
                'pd_950' => 0,
            ],
            // Fineness (finoća/karat) offered in the configurator. Price comes from
            // spot_prices[price_key] AS IS (already the price of that alloy per
            // gram — never × purity). Density g/cm³ per metal slug (wp_zs_options
            // group "material"); 0 = that metal isn't made in this fineness.
            // `deepen` = swatch colour tint only.
            'finoce'          => [
                ['id' => '585', 'label' => '585', 'sub' => '14K', 'price_key' => 'au_14k', 'enabled' => 1, 'deepen' => 0,
                    'density' => ['zuto' => 13.07, 'belo' => 12.90, 'crveno' => 13.00]],
                ['id' => '750', 'label' => '750', 'sub' => '18K', 'price_key' => 'au_18k', 'enabled' => 1, 'deepen' => 0.30,
                    'density' => ['zuto' => 15.55, 'belo' => 15.90, 'crveno' => 15.45]],
                ['id' => '916', 'label' => '916', 'sub' => '22K', 'price_key' => 'au_22k', 'enabled' => 0, 'deepen' => 0.40,
                    'density' => ['zuto' => 17.80, 'belo' => 0, 'crveno' => 17.50]],
                ['id' => '999', 'label' => '999', 'sub' => '24K', 'price_key' => 'au_24k', 'enabled' => 0, 'deepen' => 0.50,
                    'density' => ['zuto' => 19.32, 'belo' => 0, 'crveno' => 0]],
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
        $stored = is_array($stored) ? $stored : [];
        $all = array_merge(self::defaults(), $stored);
        // keep newly added price keys when an older stored set lacks them
        $all['spot_prices'] = array_merge(self::defaults()['spot_prices'], (array) ($stored['spot_prices'] ?? []));

        return $all;
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
