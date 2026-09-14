<?php

namespace ZS\Configurator\Admin;

use ZS\Configurator\Data\Compiler;
use ZS\Configurator\Data\Options;
use ZS\Configurator\Data\Seeder;
use ZS\Configurator\Data\Settings;

defined('ABSPATH') || exit;

/**
 * Renders the admin screen (3 tabs: Opcije, Podešavanja, ERPNext) and handles
 * its form submissions. Deliberately plain PHP + a little CSS — no build step.
 */
final class Screen
{
    private const TABS = [
        'opcije'      => 'Opcije',
        'podesavanja' => 'Podešavanja',
        'erpnext'     => 'ERPNext',
    ];

    /* ---------------------------------------------------------------- dispatch */

    /**
     * Plain-POST entry (no-JS fallback): run the mutation, then redirect back
     * to the screen. admin.js intercepts the same forms and calls ajax()
     * instead so only the touched group re-renders — see that method.
     */
    public static function dispatch(string $action): void
    {
        $back = add_query_arg(
            ['page' => Menu::SLUG, 'tab' => sanitize_key($_POST['zs_tab'] ?? 'opcije')],
            admin_url('admin.php')
        );

        $res = self::mutate($action);
        if ($res['msg'] !== '') {
            $back = add_query_arg('msg', $res['msg'], $back);
        }
        wp_safe_redirect($back);
        exit;
    }

    /**
     * AJAX entry (wp_ajax_zs_admin). Same mutations as dispatch(), but returns
     * JSON with a freshly-rendered HTML fragment for the affected options
     * group so the page can swap just that block — no reload, no scroll jump
     * (client, 2026-09-10). Falls through to the plain POST flow if JS is off.
     */
    public static function ajax(): void
    {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['msg' => 'Nedozvoljeno.'], 403);
        }
        check_ajax_referer('zs_admin');

        $action = sanitize_key(wp_unslash($_POST['zs_action'] ?? ''));

        // "Izmeni" / "Otkaži" just need a rendered fragment, no DB write.
        if ($action === 'edit_form') {
            $id  = (int) ($_POST['id'] ?? 0);
            $add = sanitize_key(wp_unslash($_POST['add'] ?? ''));
            $row = $id ? Options::find($id) : ($add ? ['group_key' => $add] : null);
            if ($row === null) {
                wp_send_json_error(['msg' => 'Opcija nije pronađena.'], 404);
            }
            wp_send_json_success([
                'group' => $row['group_key'] ?? '',
                'mode'  => 'form',
                'html'  => self::option_form_html($row),
            ]);
        }
        if ($action === 'cancel_form') {
            $gkey = sanitize_key(wp_unslash($_POST['group_key'] ?? ''));
            wp_send_json_success([
                'group' => $gkey,
                'mode'  => 'table',
                'html'  => self::group_block_html($gkey),
            ]);
        }

        $res  = self::mutate($action);
        $gkey = $res['group'];
        wp_send_json_success([
            'group' => $gkey,
            'mode'  => 'table',
            'msg'   => $res['msg'],
            'html'  => $gkey ? self::group_block_html($gkey) : '',
        ]);
    }

    /**
     * The DB side of every admin action, shared by dispatch() and ajax().
     *
     * @return array{group: ?string, msg: string}
     */
    private static function mutate(string $action): array
    {
        switch ($action) {
            case 'save_option':
                $gkey = sanitize_key($_POST['group_key'] ?? '');
                Options::save([
                    'id'          => (int) ($_POST['id'] ?? 0),
                    'group_key'   => $gkey,
                    'slug'        => sanitize_key($_POST['slug'] ?? ''),
                    'label_sr'    => sanitize_text_field(wp_unslash($_POST['label_sr'] ?? '')),
                    'sort'        => (int) ($_POST['sort'] ?? 0),
                    'enabled'     => !empty($_POST['enabled']),
                    'available'   => !empty($_POST['available']),
                    'stock_qty'   => $_POST['stock_qty'] ?? '',
                    'erp_id'      => sanitize_text_field(wp_unslash($_POST['erp_id'] ?? '')),
                    'price_json'  => self::price_json_from_post(),
                    // params_json i compat_json se ne uređuju kroz formu (v.
                    // option_form_html) — uvek se vraćaju nepromenjeni preko
                    // skrivenog polja (client, 2026-09-14: JSON polja zbunjuju).
                    'params_json' => wp_unslash($_POST['params_json_raw'] ?? ''),
                    'compat_json' => wp_unslash($_POST['compat_json_raw'] ?? ''),
                ]);

                return ['group' => $gkey, 'msg' => 'saved'];

            case 'delete_option':
                $id   = (int) ($_POST['id'] ?? 0);
                $gkey = Options::find($id)['group_key'] ?? sanitize_key($_POST['group_key'] ?? '');
                Options::delete($id);

                return ['group' => $gkey, 'msg' => 'deleted'];

            case 'toggle':
                $id = (int) ($_POST['id'] ?? 0);
                Options::set_flag($id, sanitize_key($_POST['flag'] ?? ''), !empty($_POST['value']));

                return ['group' => Options::find($id)['group_key'] ?? sanitize_key($_POST['group_key'] ?? ''), 'msg' => ''];

            case 'reseed':
                Seeder::run();

                return ['group' => null, 'msg' => 'seeded'];

            case 'save_settings':
                Settings::update([
                    'currency'       => sanitize_text_field(wp_unslash($_POST['currency'] ?? 'RSD')),
                    'cdn_base'       => esc_url_raw(wp_unslash($_POST['cdn_base'] ?? '')),
                    'hdri_url'       => esc_url_raw(wp_unslash($_POST['hdri_url'] ?? '')),
                    'inquiry_emails' => sanitize_text_field(wp_unslash($_POST['inquiry_emails'] ?? '')),
                    'spot_prices'    => array_map(
                        static fn ($v) => (float) $v,
                        (array) ($_POST['spot_prices'] ?? [])
                    ),
                ]);

                return ['group' => null, 'msg' => 'saved'];

            case 'save_erp':
                Settings::update([
                    'erp_url'        => esc_url_raw(wp_unslash($_POST['erp_url'] ?? '')),
                    'erp_api_key'    => sanitize_text_field(wp_unslash($_POST['erp_api_key'] ?? '')),
                    'erp_api_secret' => sanitize_text_field(wp_unslash($_POST['erp_api_secret'] ?? '')),
                ]);

                return ['group' => null, 'msg' => 'saved'];
        }

        return ['group' => null, 'msg' => ''];
    }

    /* ------------------------------------------------------------------ render */

    public static function render(): void
    {
        $tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'opcije';
        if (!isset(self::TABS[$tab])) {
            $tab = 'opcije';
        }

        $logo    = ZSC_URL . 'assets/img/logo-full.png';
        $pageUrl = self::configurator_page_url();

        echo '<div class="wrap zs-admin">';

        // Brand header — replaces the stock <h1>Konfigurator</h1>.
        echo '<header class="zs-adminbar">';
        printf('<img class="zs-adminbar-logo" src="%s" alt="Zlatara Stanimirović">', esc_url($logo));
        echo '<div class="zs-adminbar-titles">';
        echo '<h1>Konfigurator</h1>';
        echo '<p>3D konfigurator burmi — opcije, cene i okruženje</p>';
        echo '</div>';
        echo '<div class="zs-adminbar-actions">';
        if ($pageUrl !== '') {
            printf(
                '<a class="zs-btn zs-btn-ghost" href="%s" target="_blank" rel="noopener">Otvori konfigurator &#8599;</a>',
                esc_url($pageUrl)
            );
        }
        printf('<span class="zs-adminbar-ver">v%s</span>', esc_html(ZSC_VERSION));
        echo '</div>';
        echo '</header>';

        echo '<hr class="wp-header-end">'; // where WP drops admin notices
        self::notice();

        echo '<nav class="zs-tabs">';
        foreach (self::TABS as $key => $label) {
            printf(
                '<a href="%s" class="zs-tab%s">%s</a>',
                esc_url(add_query_arg(['page' => Menu::SLUG, 'tab' => $key], admin_url('admin.php'))),
                $key === $tab ? ' is-active' : '',
                esc_html($label)
            );
        }
        echo '</nav>';

        echo '<div class="zs-tabpane">';
        match ($tab) {
            'podesavanja' => self::tab_settings(),
            'erpnext'     => self::tab_erp(),
            default       => self::tab_options(),
        };
        echo '</div>';

        echo '</div>';
    }

    /** URL of the first published page/post carrying the [zs_configurator]
     *  shortcode (page preferred), or '' — powers the header "open" button. */
    private static function configurator_page_url(): string
    {
        global $wpdb;
        $id = (int) $wpdb->get_var(
            "SELECT ID FROM {$wpdb->posts}
             WHERE post_status = 'publish'
               AND post_type IN ('page', 'post')
               AND post_content LIKE '%[zs_configurator%'
             ORDER BY (post_type = 'page') DESC, ID ASC
             LIMIT 1"
        );

        return $id ? (string) get_permalink($id) : '';
    }

    private static function notice(): void
    {
        $msg = isset($_GET['msg']) ? sanitize_key($_GET['msg']) : '';
        $map = [
            'saved'   => 'Sačuvano.',
            'deleted' => 'Opcija obrisana.',
            'seeded'  => 'Podrazumevane opcije dodate (postojeće nisu dirane).',
        ];
        if (isset($map[$msg])) {
            printf('<div class="notice notice-success is-dismissible"><p>%s</p></div>', esc_html($map[$msg]));
        }
    }

    private static function form_open(string $action, string $tab): void
    {
        echo '<form method="post">';
        wp_nonce_field('zs_admin');
        printf('<input type="hidden" name="zs_action" value="%s">', esc_attr($action));
        printf('<input type="hidden" name="zs_tab" value="%s">', esc_attr($tab));
    }

    /* ------------------------------------------------------------ tab: options */

    private static function tab_options(): void
    {
        // Deep-linked ?edit / ?add still render the full-page form (works with
        // JS off). With JS on, admin.js swaps just one group's block in place
        // via ajax() — see group_block_html() / option_form_html().
        $editId = isset($_GET['edit']) ? (int) $_GET['edit'] : 0;
        $adding = isset($_GET['add']) ? sanitize_key($_GET['add']) : '';
        if ($editId || $adding) {
            $row = $editId ? Options::find($editId) : ['group_key' => $adding];
            printf(
                '<div class="zs-group" data-group="%s">%s</div>',
                esc_attr($row['group_key'] ?? ''),
                self::option_form_html($row)
            );

            return;
        }

        echo '<p class="zs-muted">Sve opcije konfiguratora. Izmena se odmah odražava na <code>/wp-json/zs/v1/config</code> (keš se briše na svako čuvanje).</p>';

        self::form_open('reseed', 'opcije');
        submit_button('Dodaj podrazumevane opcije', 'secondary', '', false);
        echo '</form>';

        foreach (Options::GROUPS as $gkey => $glabel) {
            printf('<div class="zs-group" data-group="%s">%s</div>', esc_attr($gkey), self::group_block_html($gkey));
        }
    }

    /** One options group: heading + table + "add" button. Returned as HTML so
     *  ajax() can re-render just this block after a mutation. */
    private static function group_block_html(string $gkey): string
    {
        $glabel = Options::GROUPS[$gkey] ?? $gkey;
        $rows   = Options::all($gkey);

        ob_start();
        echo '<h3 class="zs-group-h">' . esc_html($glabel) . ' <span class="zs-muted">(' . esc_html($gkey) . ')</span></h3>';
        echo '<table class="widefat striped zs-opt-table"><thead><tr>';
        echo '<th>Slug</th><th>Naziv (SR)</th><th>Sort</th><th>Prikazano</th><th>Na stanju</th><th>Zaliha</th><th></th>';
        echo '</tr></thead><tbody>';

        if (!$rows) {
            echo '<tr><td colspan="7" class="zs-muted">— nema opcija —</td></tr>';
        }
        foreach ($rows as $r) {
            echo '<tr>';
            echo '<td><code>' . esc_html($r['slug']) . '</code></td>';
            echo '<td>' . esc_html($r['label_sr']) . '</td>';
            echo '<td>' . (int) $r['sort'] . '</td>';
            echo '<td>' . self::toggle_btn($r['id'], 'enabled', $r['enabled']) . '</td>';
            echo '<td>' . self::toggle_btn($r['id'], 'available', $r['available']) . '</td>';
            echo '<td>' . ($r['stock_qty'] === null ? '—' : (int) $r['stock_qty']) . '</td>';
            echo '<td class="zs-row-actions">';
            printf(
                '<a href="%s" data-zs-edit="%d">Izmeni</a> ',
                esc_url(add_query_arg(['page' => Menu::SLUG, 'tab' => 'opcije', 'edit' => $r['id']], admin_url('admin.php'))),
                (int) $r['id']
            );
            self::form_open('delete_option', 'opcije');
            printf('<input type="hidden" name="id" value="%d">', (int) $r['id']);
            printf('<input type="hidden" name="group_key" value="%s">', esc_attr($gkey));
            echo '<button class="button-link delete zs-link-danger" onclick="return confirm(\'Obrisati opciju?\')">Obriši</button>';
            echo '</form>';
            echo '</td>';
            echo '</tr>';
        }
        echo '</tbody></table>';
        printf(
            '<p><a class="button" href="%s" data-zs-add="%s">+ Dodaj u “%s”</a></p>',
            esc_url(add_query_arg(['page' => Menu::SLUG, 'tab' => 'opcije', 'add' => $gkey], admin_url('admin.php'))),
            esc_attr($gkey),
            esc_html($glabel)
        );

        return (string) ob_get_clean();
    }

    private static function toggle_btn(int $id, string $flag, bool $on): string
    {
        ob_start();
        self::form_open('toggle', 'opcije');
        printf('<input type="hidden" name="id" value="%d">', $id);
        printf('<input type="hidden" name="flag" value="%s">', esc_attr($flag));
        printf('<input type="hidden" name="value" value="%d">', $on ? 0 : 1);
        printf(
            '<button class="button button-small zs-toggle %s">%s</button>',
            $on ? 'is-on' : 'is-off',
            $on ? 'DA' : 'NE'
        );
        echo '</form>';

        return (string) ob_get_clean();
    }

    /**
     * price_json iz forme: obično prosto polje "Cena" (flat tip — v.
     * option_form_html). Za napredne tipove (per_gram, in_mass) koji nemaju
     * "amount", forma šalje nepromenjen JSON preko skrivenog polja.
     */
    private static function price_json_from_post(): string
    {
        $raw = wp_unslash($_POST['price_json_raw'] ?? '');
        if ($raw !== '') {
            return $raw;
        }

        $amount = isset($_POST['price_amount']) ? (float) $_POST['price_amount'] : 0.0;

        return wp_json_encode(['type' => 'flat', 'amount' => $amount], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '';
    }

    /**
     * The add/edit option form, as an HTML string.
     *
     * @param array<string,mixed>|null $row
     */
    private static function option_form_html(?array $row): string
    {
        if ($row === null) {
            return '<div class="notice notice-error"><p>Opcija nije pronađena.</p></div>';
        }
        $g = $row['group_key'] ?? '';

        // Inner HTML only — the caller (tab_options / admin.js) keeps it inside
        // the stable <div class="zs-group" data-group="…"> wrapper, so every
        // AJAX swap is just `container.innerHTML = html`.
        ob_start();
        $j = static fn ($v) => $v ? esc_textarea(wp_json_encode($v, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) : '';

        echo '<h3>' . (!empty($row['id']) ? 'Izmena opcije' : 'Nova opcija') . '</h3>';
        self::form_open('save_option', 'opcije');
        printf('<input type="hidden" name="id" value="%d">', (int) ($row['id'] ?? 0));

        echo '<table class="form-table"><tbody>';

        echo '<tr><th><label>Grupa</label></th><td><select name="group_key" required>';
        foreach (Options::GROUPS as $gk => $gl) {
            printf('<option value="%s" %s>%s</option>', esc_attr($gk), selected($gk, $g, false), esc_html($gl));
        }
        echo '</select></td></tr>';

        self::text_row('slug', 'Slug', $row['slug'] ?? '', 'a-z, 0-9, crtica — jedinstven u grupi');
        self::text_row('label_sr', 'Naziv (SR)', $row['label_sr'] ?? '');
        self::text_row('sort', 'Sort', (string) ($row['sort'] ?? 0), 'manji broj = više u listi', 'number');

        printf(
            '<tr><th>Prikazano</th><td><label><input type="checkbox" name="enabled" value="1" %s> vidljivo u konfiguratoru</label></td></tr>',
            checked(!empty($row['enabled']) || !isset($row['enabled']), true, false)
        );
        printf(
            '<tr><th>Na stanju</th><td><label><input type="checkbox" name="available" value="1" %s> može se izabrati (inače disabled)</label></td></tr>',
            checked(!empty($row['available']) || !isset($row['available']), true, false)
        );
        self::text_row('stock_qty', 'Zaliha', isset($row['stock_qty']) && $row['stock_qty'] !== null ? (string) $row['stock_qty'] : '', 'opciono; iz ERPNext-a kasnije', 'number');
        self::text_row('erp_id', 'ERPNext ID', $row['erp_id'] ?? '', 'opciono; za buduću sinhronizaciju');

        // price_json: klijentu prikazujemo samo prosto polje "Cena" za flat tip
        // (najčešći slučaj — dodatna cena opcije). Napredni tipovi (per_gram za
        // materijal, in_mass za širinu/debljinu) nemaju "amount" pa se za njih
        // ne prikazuje ništa — JSON ostaje nepromenjen, nošen skrivenim poljem.
        $priceType = $row['price_json']['type'] ?? 'flat';
        if ($priceType === 'flat') {
            self::text_row('price_amount', 'Cena (RSD)', (string) ($row['price_json']['amount'] ?? 0), 'Dodatna cena za ovu opciju. 0 = bez doplate.', 'number');
        } else {
            printf('<input type="hidden" name="price_json_raw" value="%s">', $j($row['price_json'] ?? null));
        }

        // params_json i compat_json: sirov JSON, zbunjivao je klijenta — sklonjeno
        // iz forme za sada (client, 2026-09-14). Vrednosti ostaju nepromenjene
        // (nose ih skrivena polja); i dalje se uređuju kroz ?zscdebug=1 panel
        // ili direktno u Seeder-u.
        printf('<input type="hidden" name="params_json_raw" value="%s">', $j($row['params_json'] ?? null));
        printf('<input type="hidden" name="compat_json_raw" value="%s">', $j($row['compat_json'] ?? null));

        echo '</tbody></table>';
        submit_button('Sačuvaj opciju');
        printf(
            ' <a class="button" href="%s" data-zs-cancel="%s">Otkaži</a>',
            esc_url(add_query_arg(['page' => Menu::SLUG, 'tab' => 'opcije'], admin_url('admin.php'))),
            esc_attr($g)
        );
        echo '</form>';

        return (string) ob_get_clean();
    }

    private static function text_row(string $name, string $label, string $value, string $desc = '', string $type = 'text'): void
    {
        printf(
            '<tr><th><label for="zs-%1$s">%2$s</label></th><td><input type="%3$s" id="zs-%1$s" name="%1$s" value="%4$s" class="regular-text">%5$s</td></tr>',
            esc_attr($name),
            esc_html($label),
            esc_attr($type),
            esc_attr($value),
            $desc ? '<p class="description">' . esc_html($desc) . '</p>' : ''
        );
    }

    /* ----------------------------------------------------------- tab: settings */

    private static function tab_settings(): void
    {
        $s = Settings::all();
        self::form_open('save_settings', 'podesavanja');
        echo '<table class="form-table"><tbody>';
        self::text_row('currency', 'Valuta', (string) $s['currency'], 'prikaz cene, npr. RSD');
        self::text_row('cdn_base', 'CDN baza (URL)', (string) $s['cdn_base'], 'osnovni URL za GLB / HDRI / KTX2');
        self::text_row('hdri_url', 'HDRI URL', (string) $s['hdri_url'], 'studijsko okruženje za 3D scenu');
        self::text_row('inquiry_emails', 'Email za upite', (string) $s['inquiry_emails'], 'zarezom razdvojeno (Faza 5)');

        echo '<tr><th>Spot cene metala (RSD/g)</th><td>';
        foreach ((array) $s['spot_prices'] as $k => $v) {
            printf(
                '<p><label>%s <input type="number" step="0.01" name="spot_prices[%s]" value="%s"></label></p>',
                esc_html(strtoupper(str_replace('_', ' ', (string) $k))),
                esc_attr((string) $k),
                esc_attr((string) $v)
            );
        }
        echo '<p class="description">Ručni unos za sada; ERPNext kasnije.</p></td></tr>';
        echo '</tbody></table>';
        submit_button('Sačuvaj podešavanja');
        echo '</form>';
    }

    /* -------------------------------------------------------------- tab: erpnext */

    private static function tab_erp(): void
    {
        $s = Settings::all();
        echo '<p class="zs-muted">Stub. Read-only sinhronizacija (cena / stanje / SKU) dolazi u Fazi 6. Konfigurator nikad ne priča direktno sa ERPNext-om.</p>';
        self::form_open('save_erp', 'erpnext');
        echo '<table class="form-table"><tbody>';
        self::text_row('erp_url', 'ERPNext URL', (string) $s['erp_url']);
        self::text_row('erp_api_key', 'API key', (string) $s['erp_api_key']);
        self::text_row('erp_api_secret', 'API secret', (string) $s['erp_api_secret']);
        echo '</tbody></table>';
        submit_button('Sačuvaj', 'primary', 'submit', false);
        echo ' <button class="button" disabled title="Faza 6">Sync now</button>';
        echo '</form>';
    }
}
