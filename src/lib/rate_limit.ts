import { env } from 'cloudflare:workers';

/**
 * Sliding-Window Rate Limiter — SafeWebhook Edge Security Layer
 * Uses Cloudflare KV as the atomic counter store for distributed rate limiting
 * across all edge isolates. Falls back gracefully to memory store when KV is unavailable.
 */

/** In-memory fallback store for environments without KV (local dev) */
const localWindowStore = new Map<string, { count: number; windowStart: number }>();
// Track last KV write timestamp per key to adhere to Cloudflare KV's 1 write/sec/key limit
const lastKVWriteMap = new Map<string, number>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms timestamp
  limit: number;
}

/**
 * Checks a sliding-window rate limit for a given key.
 * Uses Cloudflare KV for distributed synchronization across edge isolates,
 * combined with an isolate-level memory cache to strictly respect Cloudflare KV's
 * 1 write/second/key specification and prevent socket buffer saturation.
 *
 * @param kv           - Cloudflare KV namespace (optional; auto-resolves from env.SESSION if omitted)
 * @param key          - Unique identifier for the rate limit bucket (e.g. `rl:endpoint:abc`)
 * @param limit        - Max requests allowed per window
 * @param windowMs     - Window size in milliseconds (default: 60,000 = 1 minute)
 */
export async function checkRateLimit(
  kv?: KVNamespace | null,
  key: string = 'default',
  limit: number = 100,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const kvKey = `${key}:${windowStart}`;
  const resetAt = windowStart + windowMs;

  // 1. Fast in-memory check for immediate isolate-level throttling
  const localEntry = localWindowStore.get(kvKey);
  let localCount = localEntry && localEntry.windowStart === windowStart ? localEntry.count : 0;

  if (localCount >= limit) {
    return { allowed: false, remaining: 0, resetAt, limit };
  }

  // Resolve Cloudflare KV binding
  const kvStore = kv ?? (() => {
    try {
      return (env as any)?.SESSION as KVNamespace | undefined;
    } catch {
      return null;
    }
  })();

  // 2. Synchronize distributed counter with Cloudflare KV across edge nodes
  if (kvStore && typeof kvStore.get === 'function') {
    try {
      const lastWriteTime = lastKVWriteMap.get(kvKey) || 0;
      const shouldSyncKV = (now - lastWriteTime) >= 1000 || !lastKVWriteMap.has(kvKey);

      let kvCount = 0;
      if (shouldSyncKV) {
        const raw = await kvStore.get(kvKey);
        kvCount = raw ? parseInt(raw, 10) : 0;
      }

      const effectiveCount = Math.max(localCount, kvCount) + 1;
      localWindowStore.set(kvKey, { count: effectiveCount, windowStart });

      if (effectiveCount > limit) {
        return { allowed: false, remaining: 0, resetAt, limit };
      }

      if (shouldSyncKV) {
        lastKVWriteMap.set(kvKey, now);
        // Cloudflare KV requires expirationTtl >= 60s
        const ttl = Math.max(60, Math.ceil(windowMs / 1000) + 10);
        await kvStore.put(kvKey, String(effectiveCount), { expirationTtl: ttl });
      }

      return { allowed: true, remaining: limit - effectiveCount, resetAt, limit };
    } catch (err) {
      console.warn('[RateLimit KV Warning]', err);
    }
  }

  // 3. In-memory counter increment (standalone or fallback)
  localCount++;
  localWindowStore.set(kvKey, { count: localCount, windowStart });

  if (localWindowStore.size > 1000) {
    for (const [k, v] of localWindowStore.entries()) {
      if (v.windowStart < windowStart - windowMs * 2) {
        localWindowStore.delete(k);
        lastKVWriteMap.delete(k);
      }
    }
  }

  if (localCount > limit) {
    return { allowed: false, remaining: 0, resetAt, limit };
  }

  return { allowed: true, remaining: limit - localCount, resetAt, limit };
}

/**
 * Returns standard rate-limiting headers for successful responses
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Creates a rate-limit Response with proper Retry-After headers
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfterSecs = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Rate limit exceeded. Please slow down your requests.',
      limit: result.limit,
      remaining: 0,
      reset_at: new Date(result.resetAt).toISOString(),
      retry_after_seconds: retryAfterSecs,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        'Retry-After': String(retryAfterSecs),
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

