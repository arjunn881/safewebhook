import type { D1Database } from '@cloudflare/workers-types';
import type { WebhookRecord, Env } from '../types/database';

/**
 * Safely resolves the Cloudflare D1 Database binding from Astro API context or Cloudflare runtime
 */
export function getDatabase(context?: { locals?: App.Locals }): D1Database {
  // 1. Try resolving from Astro context.locals.runtime.env
  const localsEnv = context?.locals?.runtime?.env as Env | undefined;
  if (localsEnv?.DB) {
    return localsEnv.DB;
  }

  // 2. Try resolving dynamically from globalThis / cloudflare environment
  const globalEnv = (globalThis as unknown as { env?: Env; DB?: D1Database });
  if (globalEnv.env?.DB) {
    return globalEnv.env.DB;
  }
  if (globalEnv.DB) {
    return globalEnv.DB;
  }

  // 3. Fallback error with clear instructions
  throw new Error(
    'Cloudflare D1 Database binding "DB" is not available in the current runtime context. ' +
    'Ensure "DB" is bound in wrangler.jsonc or passed in context.locals.runtime.env.'
  );
}

/**
 * Inserts an incoming webhook payload into the D1 `webhooks` table
 */
export async function insertWebhook(
  db: D1Database,
  record: WebhookRecord
): Promise<void> {
  const query = `
    INSERT INTO webhooks (id, endpoint_id, timestamp, method, headers, body)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  await db
    .prepare(query)
    .bind(
      record.id,
      record.endpoint_id,
      record.timestamp,
      record.method,
      record.headers,
      record.body
    )
    .run();
}

/**
 * Fetches the latest webhook entries for a given endpoint_id, sorted by newest first
 * Defaults to 50 entries, capped at 100 max for edge performance
 */
export async function getWebhookHistory(
  db: D1Database,
  endpointId: string,
  limit: number = 50
): Promise<WebhookRecord[]> {
  const safeLimit = Math.min(Math.max(1, limit), 100);

  const query = `
    SELECT id, endpoint_id, timestamp, method, headers, body
    FROM webhooks
    WHERE endpoint_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `;

  const result = await db
    .prepare(query)
    .bind(endpointId, safeLimit)
    .all<WebhookRecord>();

  return result.results || [];
}

/**
 * Purges webhook records older than the specified age in hours (default: 24 hours)
 */
export async function purgeOldWebhooks(
  db: D1Database,
  maxAgeHours: number = 24
): Promise<{ deletedCount: number; cutoff: string }> {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  const query = `
    DELETE FROM webhooks
    WHERE timestamp < ?
  `;

  const result = await db.prepare(query).bind(cutoffTime).run();
  
  // D1 meta changes reports the number of affected rows
  const changes = result.meta?.changes ?? 0;

  return {
    deletedCount: changes,
    cutoff: cutoffTime,
  };
}

/**
 * Clears all webhook records for a specific endpoint
 */
export async function deleteEndpointWebhooks(
  db: D1Database,
  endpointId: string
): Promise<number> {
  const query = `
    DELETE FROM webhooks
    WHERE endpoint_id = ?
  `;

  const result = await db.prepare(query).bind(endpointId).run();
  return result.meta?.changes ?? 0;
}
