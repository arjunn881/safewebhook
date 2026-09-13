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
        `INSERT INTO webhooks (id, endpoint_id, timestamp, method, headers, body)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.endpoint_id,
        record.timestamp,
        record.method,
        record.headers,
        record.body
      )
      .run();
    return true;
  } catch (err) {
    console.error('[D1 Insert Error]', err);
    return false;
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
        `SELECT id, endpoint_id, timestamp, method, headers, body
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
