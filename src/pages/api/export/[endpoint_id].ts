import type { APIRoute } from 'astro';
import { getWebhookHistory, safeGetDatabase } from '../../../lib/db';
import { getWebhookPayloads } from '../../../lib/kv_store';
import { isValidEndpointId, errorResponse, CORS_HEADERS } from '../../../lib/http';

export const prerender = false;

/**
 * OPTIONS Preflight Handler
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
};

/**
 * GET /api/export/:endpoint_id
 * Bulk export all captured payloads for an endpoint.
 *
 * Query params:
 *   ?format=json    (default) — pretty JSON array
 *   ?format=ndjson  — Newline-Delimited JSON (one record per line, streaming friendly)
 *   ?limit=N        — Max records (default 100, max 500)
 */
export const GET: APIRoute = async (context) => {
  const { params, url } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  const searchParams = new URL(url).searchParams;
  const format = searchParams.get('format') ?? 'json';
  const limitRaw = parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = isNaN(limitRaw) ? 100 : Math.min(Math.max(1, limitRaw), 500);

  if (!['json', 'ndjson'].includes(format)) {
    return errorResponse('Invalid format. Use ?format=json or ?format=ndjson', 400);
  }

  try {
    // Try D1 first for complete history
    const db = safeGetDatabase(context);
    let records = db ? await getWebhookHistory(db, endpointId!, limit) : [];

    // Fall back to KV/in-memory
    if (records.length === 0) {
      const kvPayloads = await getWebhookPayloads(endpointId!);
      records = kvPayloads.slice(0, limit).map((p) => ({
        id: p.id,
        endpoint_id: p.endpoint_id,
        timestamp: p.timestamp,
        method: p.method,
        headers: JSON.stringify(p.headers),
        body: p.body ?? null,
      }));
    }

    const exportedAt = new Date().toISOString();
    const filename = `safewebhook-${endpointId}-${exportedAt.slice(0, 10)}.${format === 'ndjson' ? 'ndjson' : 'json'}`;

    if (format === 'ndjson') {
      const lines = records.map((r) => JSON.stringify(r)).join('\n');
      return new Response(lines, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
          ...CORS_HEADERS,
        },
      });
    }

    // JSON format — include metadata envelope
    const output = JSON.stringify(
      {
        export_metadata: {
          endpoint_id: endpointId,
          exported_at: exportedAt,
          total_records: records.length,
          format: 'json',
          generator: 'SafeWebhook Export Engine v1.0',
        },
        records,
      },
      null,
      2
    );

    return new Response(output, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        ...CORS_HEADERS,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(`Failed to export endpoint data: ${error.message}`, 500);
  }
};
