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
                'au_8k'  => 0,
                'au_9k'  => 0,
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
            // Faza 4 (decisions #78, FAZA4 §2): densities = Wama's (10.9 / 11.2 /
            // 13.3 / 15.5, same for yellow/white/red; manganese 12.2 and Pd-white
            // 14.8 exist only in 585). `class_extra` = RSD/g added to the price
            // per gram for the price class (FAZA4 §22: special groove or edge /
            // more colours / wave or diagonal), 0 = no extra.
            'finoce'          => self::default_finoce(),
            // Rhodium plating (white gold only): flat RSD per ring.
            'rodijum'         => 0,
            // ERPNext — stub, Tab 1. Not used yet.
            'erp_url'         => '',
            'erp_api_key'     => '',
            'erp_api_secret'  => '',
        ];
    }

    /** @return array<int,array<string,mixed>> */
    public static function default_finoce(): array
    {
        $cls = ['special' => 0, 'multi' => 0, 'wavy' => 0];
        $d = static fn (float $gold, float $mn = 0, float $pd = 0) => [
            'zuto' => $gold, 'belo' => $gold, 'crveno' => $gold, 'manganovo' => $mn, 'belo-pd' => $pd,
        ];

        return [
            ['id' => '333', 'label' => '333', 'sub' => '8K', 'price_key' => 'au_8k', 'enabled' => 0, 'deepen' => 0,
                'density' => $d(10.9), 'class_extra' => $cls],
            ['id' => '375', 'label' => '375', 'sub' => '9K', 'price_key' => 'au_9k', 'enabled' => 0, 'deepen' => 0,
                'density' => $d(11.2), 'class_extra' => $cls],
            ['id' => '585', 'label' => '585', 'sub' => '14K', 'price_key' => 'au_14k', 'enabled' => 1, 'deepen' => 0,
                'density' => $d(13.3, 12.2, 14.8), 'class_extra' => $cls],
            ['id' => '750', 'label' => '750', 'sub' => '18K', 'price_key' => 'au_18k', 'enabled' => 1, 'deepen' => 0.30,
                'density' => $d(15.5), 'class_extra' => $cls],
            ['id' => '916', 'label' => '916', 'sub' => '22K', 'price_key' => 'au_22k', 'enabled' => 0, 'deepen' => 0.40,
                'density' => ['zuto' => 17.80, 'belo' => 0, 'crveno' => 17.50, 'manganovo' => 0, 'belo-pd' => 0], 'class_extra' => $cls],
            ['id' => '999', 'label' => '999', 'sub' => '24K', 'price_key' => 'au_24k', 'enabled' => 0, 'deepen' => 0.50,
                'density' => ['zuto' => 19.32, 'belo' => 0, 'crveno' => 0, 'manganovo' => 0, 'belo-pd' => 0], 'class_extra' => $cls],
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
