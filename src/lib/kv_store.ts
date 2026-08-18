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
}

// In-memory fallback ring-buffer (up to 50 payloads per endpoint)
const inMemoryStore = new Map<string, CapturedWebhookPayload[]>();

function getKV() {
  try {
    return (env as any)?.SESSION;
  } catch {
    return null;
  }
}

export async function saveWebhookPayload(
  endpointId: string,
  payload: CapturedWebhookPayload
): Promise<void> {
  // 1. Save to in-memory store
  const existing = inMemoryStore.get(endpointId) || [];
  existing.unshift(payload);
  if (existing.length > 50) {
    existing.pop();
  }
  inMemoryStore.set(endpointId, existing);

  // 2. Save to Cloudflare KV
  const kv = getKV();
  if (kv && typeof kv.put === 'function') {
    try {
      const kvKey = `wh_events_${endpointId}`;
      const raw = await kv.get(kvKey);
      let list: CapturedWebhookPayload[] = [];
      if (raw) {
        try {
          list = JSON.parse(raw);
        } catch {
          list = [];
        }
      }
      list.unshift(payload);
      if (list.length > 50) {
        list = list.slice(0, 50);
      }
      // Store in KV with 1 day expiration (86400 seconds)
      await kv.put(kvKey, JSON.stringify(list), { expirationTtl: 86400 });
    } catch (err) {
      console.error('[KV Store Error]', err);
    }
  }
}

export async function getWebhookPayloads(
  endpointId: string
): Promise<CapturedWebhookPayload[]> {
  const kv = getKV();
  if (kv && typeof kv.get === 'function') {
    try {
      const kvKey = `wh_events_${endpointId}`;
      const raw = await kv.get(kvKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[KV Get Error]', err);
    }
  }

  return inMemoryStore.get(endpointId) || [];
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
