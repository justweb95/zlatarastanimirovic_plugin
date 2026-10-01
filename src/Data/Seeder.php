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
    /** Bumped when existing rows need a data upgrade (see upgrade_data). */
    private const DATA_VERSION = 2;
    private const DATA_VERSION_OPT = 'zs_data_version';

    /**
     * One-time upgrade of rows that already exist on a site (run() never
     * touches them). Cheap on every load: a single autoloaded option check.
     *
     * v2 (Faza 3, decisions #76): profile → Wama construction id
     * (`params.wama`, only where missing) and the thickness slider 0.8–2.5 /
     * step 0.1 / default 1.2.
     */
    public static function upgrade_data(): void
    {
        if ((int) get_option(self::DATA_VERSION_OPT, 0) >= self::DATA_VERSION) {
            return;
        }
        $wama = [];
        foreach (self::rows() as $r) {
            if ($r['group_key'] === 'profile' && ! empty($r['params_json']['wama'])) {
                $wama[$r['slug']] = $r['params_json']['wama'];
            }
        }
        foreach (Options::all('profile') as $row) {
            if (isset($wama[$row['slug']]) && empty($row['params_json']['wama'])) {
                $row['params_json']['wama'] = $wama[$row['slug']];
                Options::save($row);
            }
        }
        foreach (Options::all('width') as $row) {
            if ($row['slug'] === 'thickness') {
                $row['params_json'] = array_merge((array) $row['params_json'], self::shank()['thickness']);
                Options::save($row);
            }
        }
        update_option(self::DATA_VERSION_OPT, self::DATA_VERSION, true);
        Compiler::flush_all();
    }

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
            // Faza 3 (2026-10-01, decisions #76): 0.8–2.5 in 0.1 steps, like Wama
            // (was 1.0–2.5 / 0.5, client 2026-09-06). Default = Wama ring 1.
            'thickness' => ['min' => 0.8, 'max' => 2.5, 'step' => 0.1, 'default' => 1.2, 'unit' => 'mm'],
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

        // 3 — PROFIL. Discrete cross-section, laid out in labelled groups like
        //     the Breuning/Saintmaurice reference (client, 2026-09-08 — "add
        //     more profiles like their site"). Two kinds of `shape`:
        //       - keyword ('court'/'d-comfort'/'round'/'flat') → hand-written
        //         generator, the 4 originals the client already signed off;
        //       - 'param' + knobs (dome/cham/taper/belly/point/relief, all
        //         0..1) → one parametric generator shared by the 2D card art
        //         AND the 3D LatheGeometry (configurator.js paramProfileOutline
        //         → scene.module.js), so every option genuinely renders.
        //     `fill` = cross-section fill factor for the weight formula.
        //     Order (client, 2026-09-07): "Zaobljeni" first/default, "Ravni"
        //     last within the first group.
        //     Faza 3 (2026-10-01, decisions #76): each profile is BUILT with the
        //     construction rules of a Wama Gold profile (`wama` => P1–P24, see
        //     docs/faza3/FAZA3-geometrija.md §1.1/§8, scene.module.js
        //     wamaSpec). `shape` + param knobs are kept only as fallback.
        $profiles = [
            // [slug, label, group, params(without fill), fill]
            ['zaobljeni',       'Zaobljeni',       'Osnovni profili',    ['shape' => 'court', 'wama' => 'P16'],     0.86],
            ['d-profil',        'D-profil',        'Osnovni profili',    ['shape' => 'd-comfort', 'wama' => 'P11'], 0.90],
            ['okrugli',         'Okrugli',         'Osnovni profili',    ['shape' => 'round', 'wama' => 'P10'],     0.79],
            ['ravni',           'Ravni',           'Osnovni profili',    ['shape' => 'flat', 'wama' => 'P6'],      1.00],

            ['poluokrugli',     'Poluokrugli',     'Zaobljeni profili',  ['shape' => 'param', 'wama' => 'P18', 'dome' => 1.0, 'cham' => 0.0],                   0.80],
            ['blago-zaobljeni', 'Blago zaobljeni', 'Zaobljeni profili',  ['shape' => 'param', 'wama' => 'P15', 'dome' => 0.35, 'cham' => 0.25],                 0.92],
            ['anatomski',       'Anatomski',       'Zaobljeni profili',  ['shape' => 'param', 'wama' => 'P4', 'dome' => 0.6, 'relief' => 0.5, 'cham' => 0.12], 0.84],
            ['bombirani',       'Bombirani',       'Zaobljeni profili',  ['shape' => 'param', 'wama' => 'P13', 'dome' => 0.85, 'belly' => 0.55],                0.83],

            ['ravni-faseta',    'Ravni sa fazom',  'Ravni profili',      ['shape' => 'param', 'wama' => 'P5', 'dome' => 0.0, 'cham' => 0.55],                  0.96],
            ['trapezni',        'Trapezni',        'Ravni profili',      ['shape' => 'param', 'wama' => 'P8', 'dome' => 0.05, 'taper' => 0.55, 'cham' => 0.1],  0.88],
            ['jastucasti',      'Jastučasti',      'Ravni profili',      ['shape' => 'param', 'wama' => 'P12', 'dome' => 0.28, 'cham' => 0.5, 'belly' => 0.22],  0.90],
            ['pljosnati',       'Pljosnati',       'Ravni profili',      ['shape' => 'param', 'wama' => 'P1', 'dome' => 0.14, 'cham' => 0.16],                  0.97],

            // "Šiljati profili" grupa (nozasti, siljati-oval) izbačena iz
            // ponude (client, 2026-09-14). Postojeće opcije nisu obrisane iz
            // baze — samo isključene (enabled=0) preko admin panela, zato ih
            // ovaj seed i dalje ne dira (idempotentan po group_key:slug).
        ];
        foreach ($profiles as $i => [$slug, $label, $group, $params, $fill]) {
            $rows[] = [
                'group_key' => 'profile', 'slug' => $slug, 'label_sr' => $label, 'sort' => ($i + 1) * 10,
                'price_json'  => ['type' => 'flat', 'amount' => 0],
                'params_json' => $params + ['group' => $group, 'fill' => $fill],
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
        // Labels are karat (client, 2026-09-15: "original kao kod konkurencije"
        // — Breuning/Fischer both size stones in ct, never mm). `mm` stays in
        // params_json for the 3D geometry (stone radius); `ct` is display-only
        // for now (round-brilliant mm→ct reference table, standard melee
        // sizing used industry-wide).
        $diamonds = [
            ['round-1_0', '0,005 ct', 'round', 1.0, 6000, 0.005],
            ['round-1_5', '0,015 ct', 'round', 1.5, 12000, 0.015],
            ['round-2_0', '0,03 ct',  'round', 2.0, 22000, 0.03],
        ];
        foreach ($diamonds as $i => [$slug, $label, $shape, $mm, $amount, $ct]) {
            $rows[] = [
                'group_key' => 'diamond', 'slug' => $slug, 'label_sr' => $label, 'sort' => ($i + 2) * 10,
                'available'   => 1, // client 2026-09-08: stones must be selectable (was stock-gated off)
                'price_json'  => ['type' => 'flat', 'amount' => $amount],
                'params_json' => [
                    'shape' => $shape, 'mm' => $mm, 'ct' => $ct, 'count' => 1, 'flush' => true,
                    'positionable' => true, 'posRange' => $posRange,
                ],
            ];
        }

        // 7 — GRAVURA. Constraints + flat surcharge.
        $rows[] = [
            'group_key' => 'engraving', 'slug' => 'engraving', 'label_sr' => 'Gravura', 'sort' => 10,
            'price_json'  => ['type' => 'flat', 'amount' => 3000],
            'params_json' => [
                'maxLen'      => 30, // client/Breuning parity (was 20), 2026-09-08
                'fonts'       => ['serif', 'script'],
                'sides'       => ['inside', 'outside'],
                'defaultSide' => 'inside',
            ],
        ];

        return $rows;
    }
}
