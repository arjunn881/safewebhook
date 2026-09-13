/**
 * Cloudflare KV + In-Memory Fallback Event Storage for SafeWebhook
 * Bridges cross-isolate edge delivery so webhooks received anywhere in the world
 * are instantly delivered to browser timelines.
 */
import { env } from 'cloudflare:workers';

export interface CapturedWebhookPayload {
  id: string;
  endpoint_id: string;
  timestamp: string;
  method: string;
  query_params: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  size_bytes: number;
  format: string;
  signature_provider: string | null;
  client_ip?: string;
  url?: string;
  path?: string;
  is_email?: boolean;
  email?: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  } | null;
}

// In-memory fallback ring-buffer (up to 50 payloads per endpoint)
const inMemoryStore = new Map<string, CapturedWebhookPayload[]>();
const inFlightKVWrites = new Set<string>();

function getKV() {
  try {
    return (env as any)?.SESSION;
  } catch {
    return null;
  }
}

/**
 * Saves a webhook payload to the in-memory store immediately (synchronous)
 * and returns a Promise for the KV write that can be passed to ctx.waitUntil().
 *
 * This two-phase approach prevents loopback saturation and race conditions:
 * 1. Synchronous in-memory write ensures immediate local visibility for polling and SSE.
 * 2. Asynchronous KV write is deduplicated per-endpoint so rapid bursts of requests
 *    do not fire concurrent overlapping writes to the same KV key.
 */
const pendingKVSync = new Set<string>();

export function saveWebhookPayload(
  endpointId: string,
  payload: CapturedWebhookPayload
): Promise<void> {
  // Phase 1 (sync): Save to in-memory store immediately
  const existing = inMemoryStore.get(endpointId) || [];
  existing.unshift(payload);
  if (existing.length > 50) {
    existing.pop();
  }
  inMemoryStore.set(endpointId, existing);

  // Phase 2 (async): Sync to Cloudflare KV for cross-isolate visibility
  const kv = getKV();
  if (kv && typeof kv.put === 'function') {
    if (inFlightKVWrites.has(endpointId)) {
      pendingKVSync.add(endpointId);
      return Promise.resolve();
    }

    inFlightKVWrites.add(endpointId);
    return (async () => {
      try {
        do {
          pendingKVSync.delete(endpointId);
          const kvKey = `wh_events_${endpointId}`;
          const currentList = inMemoryStore.get(endpointId) || [];
          await kv.put(kvKey, JSON.stringify(currentList), { expirationTtl: 86400 });
        } while (pendingKVSync.has(endpointId));
      } catch (err) {
        console.error('[KV Store Error]', err);
      } finally {
        inFlightKVWrites.delete(endpointId);
      }
    })();
  }
  return Promise.resolve();
}

export async function getWebhookPayloads(
  endpointId: string
): Promise<CapturedWebhookPayload[]> {
  const kv = getKV();
  const memList = inMemoryStore.get(endpointId) || [];

  if (kv && typeof kv.get === 'function') {
    try {
      const kvKey = `wh_events_${endpointId}`;
      const raw = await kv.get(kvKey);
      if (raw) {
        const kvList = JSON.parse(raw);
        if (Array.isArray(kvList)) {
          // Merge by unique id, maintaining newest-first order
          const map = new Map<string, CapturedWebhookPayload>();
          for (const item of memList) map.set(item.id, item);
          for (const item of kvList) {
            if (!map.has(item.id)) map.set(item.id, item);
          }
          const merged = Array.from(map.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 50);
          inMemoryStore.set(endpointId, merged);
          return merged;
        }
      }
    } catch (err) {
      console.error('[KV Get Error]', err);
    }
  }

  return memList;
}

export async function clearWebhookPayloads(
  endpointId: string
): Promise<void> {
  inMemoryStore.delete(endpointId);
  const kv = getKV();
  if (kv && typeof kv.delete === 'function') {
    try {
      await kv.delete(`wh_events_${endpointId}`);
    } catch {}
  }
}
