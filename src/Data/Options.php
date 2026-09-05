<?php

namespace ZS\Configurator\Data;

defined('ABSPATH') || exit;

/**
 * Query layer over wp_zs_options. Thin wrapper around $wpdb; JSON columns are
 * decoded/encoded here so the rest of the plugin deals in PHP arrays only.
 */
final class Options
{
    /** The 7 option groups, in configurator step order. */
    public const GROUPS = [
        'model'    => 'Model',
        'material' => 'Materijal',
        'profile'  => 'Profil',
        'width'    => 'Širina',
        'finish'   => 'Završna obrada',
        'diamond'  => 'Dijamanti',
        'engraving' => 'Gravura',
    ];

    private const JSON_COLS = ['price_json', 'params_json', 'compat_json'];

    /** @return array<int,array<string,mixed>> */
    public static function all(?string $group = null, bool $only_enabled = false): array
    {
        global $wpdb;
        $table = Schema::table();

        $where = [];
        $args  = [];
        if ($group !== null) {
            $where[] = 'group_key = %s';
            $args[]  = $group;
        }
        if ($only_enabled) {
            $where[] = 'enabled = 1';
        }
        $sql = "SELECT * FROM {$table}";
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY sort ASC, id ASC';

        $rows = $args
            ? $wpdb->get_results($wpdb->prepare($sql, $args), ARRAY_A)
            : $wpdb->get_results($sql, ARRAY_A);

        return array_map([self::class, 'hydrate'], $rows ?: []);
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        global $wpdb;
        $table = Schema::table();
        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id),
            ARRAY_A
        );

        return $row ? self::hydrate($row) : null;
    }

    /**
     * Insert or update. Pass 'id' to update.
     *
     * @param array<string,mixed> $data
     * @return int row id
     */
    public static function save(array $data): int
    {
        global $wpdb;
        $table = Schema::table();

        $fields = [
            'group_key' => (string) ($data['group_key'] ?? ''),
            'slug'      => sanitize_key($data['slug'] ?? ''),
            'label_sr'  => sanitize_text_field($data['label_sr'] ?? ''),
            'sort'      => (int) ($data['sort'] ?? 0),
            'enabled'   => empty($data['enabled']) ? 0 : 1,
            'available' => empty($data['available']) ? 0 : 1,
            'stock_qty' => isset($data['stock_qty']) && $data['stock_qty'] !== '' ? (int) $data['stock_qty'] : null,
            'erp_id'    => isset($data['erp_id']) && $data['erp_id'] !== '' ? sanitize_text_field($data['erp_id']) : null,
            'updated_at' => current_time('mysql'),
        ];
        foreach (self::JSON_COLS as $col) {
            $fields[$col] = self::normalize_json($data[$col] ?? null);
        }

        $formats = ['%s', '%s', '%s', '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s'];

        if (!empty($data['id'])) {
            $wpdb->update($table, $fields, ['id' => (int) $data['id']], $formats, ['%d']);
            $id = (int) $data['id'];
        } else {
            $wpdb->insert($table, $fields, $formats);
            $id = (int) $wpdb->insert_id;
        }

        Compiler::flush_all();

        return $id;
    }

    public static function delete(int $id): void
    {
        global $wpdb;
        $wpdb->delete(Schema::table(), ['id' => $id], ['%d']);
        Compiler::flush_all();
    }

    public static function set_flag(int $id, string $flag, bool $value): void
    {
        if (!in_array($flag, ['enabled', 'available'], true)) {
            return;
        }
        global $wpdb;
        $wpdb->update(
            Schema::table(),
            [$flag => $value ? 1 : 0, 'updated_at' => current_time('mysql')],
            ['id' => $id],
            ['%d', '%s'],
            ['%d']
        );
        Compiler::flush_all();
    }

    /** @param array<string,mixed> $row */
    private static function hydrate(array $row): array
    {
        foreach (self::JSON_COLS as $col) {
            $decoded = $row[$col] !== null && $row[$col] !== ''
                ? json_decode((string) $row[$col], true)
                : [];
            $row[$col] = is_array($decoded) ? $decoded : [];
        }
        $row['id']        = (int) $row['id'];
        $row['sort']      = (int) $row['sort'];
        $row['enabled']   = (bool) $row['enabled'];
        $row['available'] = (bool) $row['available'];
        $row['stock_qty'] = $row['stock_qty'] === null ? null : (int) $row['stock_qty'];

        return $row;
    }

    /** Accepts a JSON string or an array; returns a compact JSON string or null. */
    private static function normalize_json(mixed $value): ?string
    {
        if ($value === null || $value === '' || $value === []) {
            return null;
        }
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return null; // invalid JSON from the textarea — drop rather than store garbage
            }
            $value = $decoded;
        }

        return wp_json_encode($value);
    }
}
