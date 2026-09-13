import type { APIRoute } from 'astro';
import { jsonResponse, CORS_HEADERS } from '../../lib/http';
import { safeGetDatabase } from '../../lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

const BUILD_VERSION = '1.0.0';
const BUILD_DATE = new Date().toISOString().slice(0, 10);

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
 * GET /api/health — Production Health Check Endpoint
 * Returns runtime status, storage connectivity, and version metadata.
 * Used by uptime monitors and deployment pipelines.
 */
export const GET: APIRoute = async (context) => {
  const startTime = performance.now();

  const cfEnv = env as unknown as Record<string, unknown>;

  const status: Record<string, unknown> = {
    status: 'ok',
    version: BUILD_VERSION,
    build_date: BUILD_DATE,
    timestamp: new Date().toISOString(),
    runtime: 'cloudflare-workers',
    region: cfEnv?.CF_REGION ?? 'unknown',
  };

  // Check D1 Database connectivity
  let d1Status = 'unavailable';
  try {
    const db = safeGetDatabase(context);
    if (db) {
      const result = await db.prepare('SELECT 1 AS ok').first<{ ok: number }>();
      d1Status = result?.ok === 1 ? 'ok' : 'error';
    }
  } catch {
    d1Status = 'error';
  }

  // Check KV connectivity
  let kvStatus = 'unavailable';
  try {
    const kv = (cfEnv?.SESSION ?? cfEnv?.KV) as KVNamespace | undefined;
    if (kv && typeof kv.get === 'function') {
      await kv.get('__health_check__');
      kvStatus = 'ok';
    }
  } catch {
    kvStatus = 'error';
  }

  const durationMs = Math.round(performance.now() - startTime);

  const response = {
    ...status,
    checks: {
      d1_database: d1Status,
      kv_store: kvStatus,
    },
    latency_ms: durationMs,
    healthy: d1Status !== 'error' && kvStatus !== 'error',
  };

  const httpStatus = response.healthy ? 200 : 503;
  return jsonResponse(response, httpStatus, {
    'Cache-Control': 'no-store, no-cache',
    'X-Health-Check-Duration': `${durationMs}ms`,
  });
};
