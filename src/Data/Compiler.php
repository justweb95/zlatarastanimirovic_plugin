<?php

namespace ZS\Configurator\Data;

defined('ABSPATH') || exit;

/**
 * Compiles wp_zs_options + zs_settings into one normalized JSON payload per model
 * (compatibility resolved server-side, prices attached, availability flattened).
 * Cached in a transient; the cache version doubles as the REST ETag.
 */
final class Compiler
{
    private const VERSION_OPT   = 'zs_config_version';
    private const TRANSIENT_PRE = 'zs_config_';
    private const TTL           = 12 * HOUR_IN_SECONDS;

    /** Bumped on any option/settings change → invalidates transients + ETags. */
    public static function version(): string
    {
        $v = get_option(self::VERSION_OPT);
        if (!$v) {
            $v = gmdate('Y-m-d\TH:i:s\Z');
            update_option(self::VERSION_OPT, $v, false);
        }

        return (string) $v;
    }

    public static function flush_all(): void
    {
        update_option(self::VERSION_OPT, gmdate('Y-m-d\TH:i:s\Z'), false);

        global $wpdb;
        $like = $wpdb->esc_like('_transient_' . self::TRANSIENT_PRE) . '%';
        $wpdb->query(
            $wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $like)
        );
        $like_t = $wpdb->esc_like('_transient_timeout_' . self::TRANSIENT_PRE) . '%';
        $wpdb->query(
            $wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $like_t)
        );
    }

    /**
     * @return array{version:string,payload:array<string,mixed>}
     */
    public static function get(string $model_slug = ''): array
    {
        $version = self::version();
        $model_slug = sanitize_key($model_slug);
        $key = self::TRANSIENT_PRE . md5($version . '|' . $model_slug);

        $cached = get_transient($key);
        if (is_array($cached)) {
            return ['version' => $version, 'payload' => $cached];
        }

        $payload = self::build($model_slug, $version);
        set_transient($key, $payload, self::TTL);

        return ['version' => $version, 'payload' => $payload];
    }

    /** @return array<string,mixed> */
    private static function build(string $model_slug, string $version): array
    {
        $settings = Settings::all();
        $models   = Options::all('model', true);

        $model = null;
        foreach ($models as $m) {
            if ($model_slug === '' || $m['slug'] === $model_slug) {
                $model = $m;
                break;
            }
        }
        $model ??= $models[0] ?? null;

        $groups = [];
        foreach (['material', 'profile', 'finish', 'diamond'] as $g) {
            $groups[$g] = array_values(array_map(
                static fn (array $r) => self::pack_option($r, $model),
                array_filter(
                    Options::all($g, true),
                    static fn (array $r) => self::compatible($r, $model)
                )
            ));
        }

        // group "width" holds two slider rows: width + thickness (client spec).
        $sliders = [];
        foreach (Options::all('width', true) as $r) {
            $sliders[$r['slug']] = $r['params_json'];
        }

        $engravingRow = Options::all('engraving', true)[0] ?? null;
        $engraving = $engravingRow ? array_merge(
            $engravingRow['params_json'],
            ['price' => $engravingRow['price_json'], 'available' => $engravingRow['available']]
        ) : null;

        return [
            'version'  => $version,
            'currency' => $settings['currency'],
            'cdnBase'  => $settings['cdn_base'],
            'hdriUrl'  => $settings['hdri_url'],
            'models'   => array_map(
                static fn (array $r) => [
                    'slug'      => $r['slug'],
                    'label'     => $r['label_sr'],
                    'basePrice' => (float) ($r['price_json']['amount'] ?? 0),
                    'params'    => $r['params_json'],
                ],
                $models
            ),
            'model' => $model ? [
                'slug'      => $model['slug'],
                'label'     => $model['label_sr'],
                'basePrice' => (float) ($model['price_json']['amount'] ?? 0),
                'shank'     => $model['params_json']['shank'] ?? null,
                'profile'   => $model['params_json']['profile'] ?? null,
                'fill'      => $model['params_json']['fill'] ?? null,
                'stone'     => $model['params_json']['stone'] ?? null,
                'renders'   => $model['params_json']['renders'] ?? null,
                'preset'    => $model['params_json']['preset'] ?? 'band',
            ] : null,
            'groups' => array_merge($groups, [
                'width'     => $sliders['width'] ?? null,
                'thickness' => $sliders['thickness'] ?? null,
                'engraving' => $engraving,
            ]),
            // Everything the client-side live estimate needs. Authoritative price
            // is recomputed server-side on inquiry (Faza 5). Formula (Faza 3,
            // decisions #76/#77 — volume of the actual 3D band mesh, grooves
            // included, computed client-side; `fill` is only the pre-load fallback):
            //   volume_cm3           = band mesh volume_mm3 / 1000
            //   weight_g            = volume_cm3 * density(finoća)
            //   ringPrice           = ceil(weight_g * pricePerGram(finoća) + finish + diamond + engraving)
            //   pairPrice           = ringHer + ringHis   (each ring ceiled on its own, #77)
            'pricing' => [
                'currency'    => $settings['currency'],
                // Admin-entered RSD/g per fineness (the ONLY price source, #77).
                'spotPrices'  => $settings['spot_prices'],
                // Offered finenesses: price key + density per metal (enabled only).
                'finoce'      => array_values(array_filter(
                    (array) $settings['finoce'],
                    static fn ($f) => ! empty($f['enabled'])
                )),
                // Rhodium plating, flat RSD per ring (white gold, decisions #78).
                'rhodium'     => (float) ($settings['rodijum'] ?? 0),
                'formula'     => 'ringPrice = ceil(sum_bands(V/1000 * density(metal, finoca) * (pricePerGram + classExtra + metal.surcharge_per_gram)) + metal flat surcharges + rhodium + extras)',
            ],
            'spotPrices' => $settings['spot_prices'],
        ];
    }

    /** @param array<string,mixed> $row @param array<string,mixed>|null $model */
    private static function pack_option(array $row, ?array $model): array
    {
        return [
            'slug'      => $row['slug'],
            'label'     => $row['label_sr'],
            'available' => $row['available'],
            'price'     => $row['price_json'],
            'params'    => $row['params_json'],
        ];
    }

    /**
     * compat_json allow-lists: {models:[...], materials:[...]}. Empty = allow all.
     *
     * @param array<string,mixed> $row @param array<string,mixed>|null $model
     */
    private static function compatible(array $row, ?array $model): bool
    {
        $compat = $row['compat_json'] ?? [];
        if (empty($compat['models']) || !$model) {
            return true;
        }

        return in_array($model['slug'], (array) $compat['models'], true);
    }
}
