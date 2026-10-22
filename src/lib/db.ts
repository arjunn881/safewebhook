import type { D1Database } from '@cloudflare/workers-types';
import type { WebhookRecord, Env } from '../types/database';
import { env } from 'cloudflare:workers';

/**
 * Safely resolves the Cloudflare D1 Database binding without throwing unhandled exceptions.
 * Returns null if D1 is not bound (e.g. during local Astro dev server without D1 proxy).
 */
export function safeGetDatabase(_context?: unknown): D1Database | null {
  try {
    // 1. Try resolving from cloudflare:workers env
    const cfEnv = env as unknown as Env;
    if (cfEnv?.DB) {
      return cfEnv.DB;
    }

    // 2. Try resolving dynamically from globalThis
    const globalEnv = globalThis as unknown as { env?: Env; DB?: D1Database };
    if (globalEnv.env?.DB) {
      return globalEnv.env.DB;
    }
    if (globalEnv.DB) {
      return globalEnv.DB;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves D1 Database binding or throws informative error if required
 */
export function getDatabase(_context?: unknown): D1Database {
  const db = safeGetDatabase(_context);
  if (db) return db;

  throw new Error(
    'Cloudflare D1 Database binding "DB" is not available in the current runtime context. ' +
    'Ensure "DB" is bound in wrangler.jsonc.'
  );
}

/**
 * Inserts an incoming webhook payload into the D1 `webhooks` table.
 *
 * NOTE: The `webhooks` table must already exist. Apply schema once before use:
 *   - Local dev:   npx wrangler d1 execute DB --local  --file schema.sql
 *   - Production:  npx wrangler d1 execute DB --remote --file schema.sql
 */
export async function insertWebhook(
  db: D1Database | null,
  record: WebhookRecord
): Promise<boolean> {
  if (!db || typeof db.prepare !== 'function') return false;

  try {
    await db
      .prepare(
        `INSERT INTO webhooks (id, endpoint_id, timestamp, method, headers, body, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.endpoint_id,
        record.timestamp,
        record.method,
        record.headers,
        record.body,
        record.size_bytes ?? (record.body ? new TextEncoder().encode(record.body).length : 0)
      )
      .run();
    return true;
  } catch (err) {
    console.error('[D1 Insert Error]', err);
    return false;
  }
}

export interface WebhookStatsAggregate {
  total_requests: number;
  requests_last_hour: number;
  requests_last_24h: number;
  avg_payload_size_bytes: number;
  first_seen: string | null;
  last_seen: string | null;
}

/** Uses D1 aggregates so analytics do not silently stop at the history page size. */
export async function getWebhookStatsAggregate(
  db: D1Database | null,
  endpointId: string,
  now = Date.now()
): Promise<WebhookStatsAggregate | null> {
  if (!db || typeof db.prepare !== 'function') return null;
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  try {
    const row = await db.prepare(
      `SELECT
         COUNT(*) AS total_requests,
         SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) AS requests_last_hour,
         SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) AS requests_last_24h,
         COALESCE(AVG(CASE WHEN size_bytes > 0 THEN size_bytes ELSE length(COALESCE(body, '')) END), 0) AS avg_payload_size_bytes,
         MIN(timestamp) AS first_seen,
         MAX(timestamp) AS last_seen
       FROM webhooks
       WHERE endpoint_id = ?`
    ).bind(oneHourAgo, oneDayAgo, endpointId).first<{
      total_requests: number | string;
      requests_last_hour: number | string | null;
      requests_last_24h: number | string | null;
      avg_payload_size_bytes: number | string | null;
      first_seen: string | null;
      last_seen: string | null;
    }>();

    if (!row) return null;
    return {
      total_requests: Number(row.total_requests) || 0,
      requests_last_hour: Number(row.requests_last_hour) || 0,
      requests_last_24h: Number(row.requests_last_24h) || 0,
      avg_payload_size_bytes: Math.round(Number(row.avg_payload_size_bytes) || 0),
      first_seen: row.first_seen || null,
      last_seen: row.last_seen || null,
    };
  } catch (err) {
    console.error('[D1 Stats Aggregate Error]', err);
    return null;
  }
}

export async function getWebhookMethodCounts(
  db: D1Database | null,
  endpointId: string
): Promise<Record<string, number> | null> {
  if (!db || typeof db.prepare !== 'function') return null;
  try {
    const result = await db.prepare(
      `SELECT method, COUNT(*) AS count
       FROM webhooks
       WHERE endpoint_id = ?
       GROUP BY method`
    ).bind(endpointId).all<{ method: string; count: number | string }>();
    const counts: Record<string, number> = {};
    for (const row of result.results || []) counts[row.method] = Number(row.count) || 0;
    return counts;
  } catch (err) {
    console.error('[D1 Method Stats Error]', err);
    return null;
  }
}

/**
 * Fetches the latest webhook entries for a given endpoint_id, sorted by newest first.
 * Defaults to 50 entries, capped at 100 max for edge performance.
 */
export async function getWebhookHistory(
  db: D1Database | null,
  endpointId: string,
  limit: number = 50
): Promise<WebhookRecord[]> {
  if (!db || typeof db.prepare !== 'function') return [];

  try {
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const result = await db
      .prepare(
        `SELECT id, endpoint_id, timestamp, method, headers, body, size_bytes
         FROM webhooks
         WHERE endpoint_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .bind(endpointId, safeLimit)
      .all<WebhookRecord>();

    return result.results || [];
  } catch (err) {
    console.error('[D1 History Error]', err);
    return [];
  }
}

/**
 * Purges webhook records older than the specified age in hours (default: 24 hours).
 */
export async function purgeOldWebhooks(
  db: D1Database | null,
  maxAgeHours: number = 24
): Promise<{ deletedCount: number; cutoff: string }> {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  if (!db || typeof db.prepare !== 'function') {
    return { deletedCount: 0, cutoff: cutoffTime };
  }

  try {
    const result = await db
      .prepare(`DELETE FROM webhooks WHERE timestamp < ?`)
      .bind(cutoffTime)
      .run();
    const changes = result.meta?.changes ?? 0;

    return { deletedCount: changes, cutoff: cutoffTime };
  } catch (err) {
    console.error('[D1 Purge Error]', err);
    return { deletedCount: 0, cutoff: cutoffTime };
  }
}

/**
 * Clears all webhook records for a specific endpoint.
 */
export async function deleteEndpointWebhooks(
  db: D1Database | null,
  endpointId: string
): Promise<number> {
  if (!db || typeof db.prepare !== 'function') return 0;

  try {
    const result = await db
      .prepare(`DELETE FROM webhooks WHERE endpoint_id = ?`)
      .bind(endpointId)
      .run();
    return result.meta?.changes ?? 0;
  } catch (err) {
    console.error('[D1 Delete Endpoint Error]', err);
    return 0;
  }
}
