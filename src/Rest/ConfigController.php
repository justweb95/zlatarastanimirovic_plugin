<?php

namespace ZS\Configurator\Rest;

use WP_REST_Request;
use WP_REST_Response;
use ZS\Configurator\Data\Compiler;

defined('ABSPATH') || exit;

/**
 * GET /wp-json/zs/v1/config?model=slug — one cached payload for the whole UI.
 * ETag / 304 so repeat loads cost nothing.
 */
final class ConfigController
{
    private const NS = 'zs/v1';

    public function register_routes(): void
    {
        register_rest_route(self::NS, '/config', [
            'methods'             => 'GET',
            'permission_callback' => '__return_true', // public read
            'args'                => [
                'model' => [
                    'type'              => 'string',
                    'required'          => false,
                    'sanitize_callback' => 'sanitize_key',
                ],
            ],
            'callback' => [$this, 'get_config'],
        ]);
    }

    public function get_config(WP_REST_Request $request): WP_REST_Response
    {
        $model = (string) $request->get_param('model');
        $result = Compiler::get($model);

        $etag = '"' . md5($result['version'] . '|' . $model) . '"';
        $inm  = trim((string) $request->get_header('if_none_match'));

        if ($inm !== '' && $inm === $etag) {
            $res = new WP_REST_Response(null, 304);
            $res->header('ETag', $etag);
            $res->header('Cache-Control', 'public, max-age=0, must-revalidate');

            return $res;
        }

        $res = new WP_REST_Response($result['payload'], 200);
        $res->header('ETag', $etag);
        $res->header('Cache-Control', 'public, max-age=0, must-revalidate');

        return $res;
    }
}
