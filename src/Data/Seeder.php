<?php

namespace ZS\Configurator\Data;

defined('ABSPATH') || exit;

/**
 * Default option set for the 7 groups.
 *
 * Sourced from the client's real assets in "Konfigurator za burme/":
 *  - metals + finishes from the V-Ray materials (*.gvVisMat → *.vismat): filter
 *    colour + reflection glossiness, translated to MeshPhysicalMaterial params.
 *  - band dimensions from the Rhino files (Ravna_4mm.3dm / Zaobljena_4mm.3dm):
 *    4 mm nominal width, ~1.3 mm wall, 17.5 mm inner Ø ≈ EU 55.
 *  - width / thickness ranges + weight formula from the client (2026-09-03):
 *    width 3.0–8.0 step 0.5, thickness from 1.0 mm step 0.1;
 *    weight_g = volume_cm3 × specific_gravity(finoća).
 *
 * Idempotent: an existing (group_key, slug) is left untouched.
 */
final class Seeder
{
    public static function run(): void
    {
        global $wpdb;
        $table = Schema::table();

        $existing = $wpdb->get_col("SELECT CONCAT(group_key, ':', slug) FROM {$table}");
        $existing = array_flip($existing ?: []);

        foreach (self::rows() as $row) {
            $key = $row['group_key'] . ':' . $row['slug'];
            if (isset($existing[$key])) {
                continue;
            }
            Options::save($row + ['enabled' => 1, 'available' => 1]);
        }
    }

    /** Shank slider ranges shared by the band models (client spec). */
    private static function shank(): array
    {
        return [
            'width'     => ['min' => 3.0, 'max' => 8.0, 'step' => 0.5, 'default' => 4.0, 'unit' => 'mm'],
            // step 0.5 (client, 2026-09-06): was 0.1 — produced ugly non-aligned tick
            // labels (4.3/5.5/6.8 instead of clean halves). Default nudged 1.4→1.5 to
            // land on the new grid.
            'thickness' => ['min' => 1.0, 'max' => 2.5, 'step' => 0.5, 'default' => 1.5, 'unit' => 'mm'],
            'size'      => ['min' => 44,  'max' => 68,  'step' => 0.5, 'default' => 54,  'unit' => 'EU'],
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private static function rows(): array
    {
        $rows = [];
        $shank = self::shank();

        // 1 — MODEL. Plain wedding bands (burme). "renders" is an optional map of
        //     material-slug → image URL, shown in the viewport until the WebGL
        //     scene lands (Faza 2).
        $rows[] = [
            'group_key' => 'model', 'slug' => 'ravna', 'label_sr' => 'Ravna', 'sort' => 20,
            'price_json'  => ['type' => 'flat', 'amount' => 0],
            'params_json' => [
                'preset'  => 'band',
                'profile' => 'ravni',          // default cross-section
                'fill'    => 1.00,             // cross-section fill factor for the weight formula
                'shank'   => $shank,
                'cad'     => 'Ravna_4mm.3dm',
                'renders' => new \stdClass(),
            ],
        ];
        $rows[] = [
            'group_key' => 'model', 'slug' => 'zaobljena', 'label_sr' => 'Zaobljena', 'sort' => 10,
            'price_json'  => ['type' => 'flat', 'amount' => 0],
            'params_json' => [
                'preset'  => 'band',
                'profile' => 'zaobljeni',
                'fill'    => 0.86,            // domed outside → less metal than a flat slab
                'shank'   => $shank,
                'cad'     => 'Zaobljena_4mm.3dm',
                'renders' => new \stdClass(),
            ],
        ];
        $rows[] = [
            'group_key' => 'model', 'slug' => 'ravna-kamen', 'label_sr' => 'Ravna sa kamenom', 'sort' => 30,
            'price_json'  => ['type' => 'flat', 'amount' => 0],
            'params_json' => [
                'preset'  => 'band',
                'profile' => 'ravni',
                'fill'    => 1.00,
                'shank'   => $shank,
                'stone'   => ['shape' => 'round', 'mm' => 1.5, 'count' => 1, 'flush' => true],
                'cad'     => 'Ravna 4mm sa kamenom 1,5mm.3dm',
                'renders' => new \stdClass(),
            ],
        ];
        $rows[] = [
            'group_key' => 'model', 'slug' => 'zaobljena-kamen', 'label_sr' => 'Zaobljena sa kamenom', 'sort' => 40,
            'price_json'  => ['type' => 'flat', 'amount' => 0],
            'params_json' => [
                'preset'  => 'band',
                'profile' => 'zaobljeni',
                'fill'    => 0.86,
                'shank'   => $shank,
                'stone'   => ['shape' => 'round', 'mm' => 1.5, 'count' => 1, 'flush' => true],
                'cad'     => 'Zaobljena 4mm sa kamenom 1,5mm.3dm',
                'renders' => new \stdClass(),
            ],
        ];

        // 2 — MATERIJAL. 3 golds, all 14K (client's real catalogue). density =
        //     specific gravity g/cm³ used by the weight formula; spot_key points
        //     at a per-gram price in Podešavanja. finish variants live in group 5.
        $materials = [
            // slug,  label,             filter colour, density(14K), spot_key
            // Colours sharpened/richened (client, 2026-09-06) — same 3 golds, more
            // saturated + less washed-out than the original V-Ray filter-colour pull.
            ['zuto',   'Žuto zlato',   '#D9A945', 13.07, 'au_14k'],
            ['belo',   'Belo zlato',   '#D6D9DE', 12.90, 'au_14k'],
            ['crveno', 'Crveno zlato', '#E8A28C', 13.00, 'au_14k'],
        ];
        foreach ($materials as $i => [$slug, $label, $color, $density, $spotKey]) {
            $rows[] = [
                'group_key' => 'material', 'slug' => $slug, 'label_sr' => $label, 'sort' => ($i + 1) * 10,
                'price_json'  => ['type' => 'per_gram', 'spot_key' => $spotKey, 'density' => $density, 'finoca' => '585'],
                'params_json' => ['pbr' => ['color' => $color, 'metalness' => 1.0, 'roughness' => 0.08]],
            ];
        }

        // 3 — PROFIL. Discrete cross-section. shape → THREE.Shape generator;
        //     fill → cross-section fill factor for the weight formula.
        // Order (client, 2026-09-07): "Zaobljeni" first/default, "Ravni" last —
        // same "starts from rounded" preference as decisions.md's earlier
        // model-sort note, now re-applied to the Profil group directly.
        $profiles = [
            ['zaobljeni', 'Zaobljeni', 'court',   0.86],
            ['d-profil', 'D-profil', 'd-comfort', 0.90],
            ['okrugli', 'Okrugli',  'round',      0.79],
            ['ravni',   'Ravni',    'flat',      1.00],
        ];
        foreach ($profiles as $i => [$slug, $label, $shape, $fill]) {
            $rows[] = [
                'group_key' => 'profile', 'slug' => $slug, 'label_sr' => $label, 'sort' => ($i + 1) * 10,
                'price_json'  => ['type' => 'flat', 'amount' => 0],
                'params_json' => ['shape' => $shape, 'fill' => $fill],
            ];
        }

        // 4 — ŠIRINA + DEBLJINA. Two sliders (client spec, resolves question D).
        $rows[] = [
            'group_key' => 'width', 'slug' => 'width', 'label_sr' => 'Širina', 'sort' => 10,
            'price_json'  => ['type' => 'in_mass'],
            'params_json' => $shank['width'],
        ];
        $rows[] = [
            'group_key' => 'width', 'slug' => 'thickness', 'label_sr' => 'Debljina', 'sort' => 20,
            'price_json'  => ['type' => 'in_mass'],
            'params_json' => $shank['thickness'],
        ];

        // 5 — ZAVRŠNA OBRADA. From the .vismat reflection glossiness.
        //     roughness ≈ 1 − glossiness (clamped to a sane PBR range).
        $finishes = [
            ['polirano', 'Polirano', ['roughness' => 0.06], 0],                                   // gloss 1.0
            ['mat',      'Mat',      ['roughness' => 0.42], 0],                                   // gloss 0.5
            ['grebano',  'Grebano',  ['roughness' => 0.34, 'normalMap' => 'brushed', 'anisotropy' => 0.7], 0], // gloss 0.6
        ];
        foreach ($finishes as $i => [$slug, $label, $pbr, $amount]) {
            $rows[] = [
                'group_key' => 'finish', 'slug' => $slug, 'label_sr' => $label, 'sort' => ($i + 1) * 10,
                'price_json'  => ['type' => 'flat', 'amount' => $amount],
                'params_json' => ['pbr' => $pbr],
            ];
        }

        // 6 — DIJAMANTI (v1). One flush-set round stone: choose size + position
        //     along the band (position is a per-config slider, range below).
        //     Stock-gated. v2: multiple stones / pavé row / setting type / shapes
        //     — see docs/roadmap.md "Tehnički dug".
        $posRange = ['min' => -10.0, 'max' => 10.0, 'step' => 0.5, 'default' => 0.0, 'unit' => 'mm'];
        $rows[] = [
            'group_key' => 'diamond', 'slug' => 'bez', 'label_sr' => 'Bez dijamanta', 'sort' => 10,
            'price_json'  => ['type' => 'flat', 'amount' => 0],
            'params_json' => ['shape' => null, 'mm' => 0, 'count' => 0],
        ];
        $diamonds = [
            ['round-1_0', 'Rund Ø1.0 mm', 'round', 1.0, 6000],
            ['round-1_5', 'Rund Ø1.5 mm', 'round', 1.5, 12000],
            ['round-2_0', 'Rund Ø2.0 mm', 'round', 2.0, 22000],
        ];
        foreach ($diamonds as $i => [$slug, $label, $shape, $mm, $amount]) {
            $rows[] = [
                'group_key' => 'diamond', 'slug' => $slug, 'label_sr' => $label, 'sort' => ($i + 2) * 10,
                'available'   => 0,
                'price_json'  => ['type' => 'flat', 'amount' => $amount],
                'params_json' => [
                    'shape' => $shape, 'mm' => $mm, 'count' => 1, 'flush' => true,
                    'positionable' => true, 'posRange' => $posRange,
                ],
            ];
        }

        // 7 — GRAVURA. Constraints + flat surcharge.
        $rows[] = [
            'group_key' => 'engraving', 'slug' => 'engraving', 'label_sr' => 'Gravura', 'sort' => 10,
            'price_json'  => ['type' => 'flat', 'amount' => 3000],
            'params_json' => [
                'maxLen'      => 20,
                'fonts'       => ['serif', 'script'],
                'sides'       => ['inside', 'outside'],
                'defaultSide' => 'inside',
            ],
        ];

        return $rows;
    }
}
