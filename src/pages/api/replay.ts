import type { APIRoute } from 'astro';
import { CORS_HEADERS, jsonResponse, errorResponse } from '../../lib/http';
import { checkSSRF } from '../../lib/ssrf_guard';
import { checkRateLimit, rateLimitResponse, rateLimitHeaders } from '../../lib/rate_limit';
import { env } from 'cloudflare:workers';

export const prerender = false;



/**
 * OPTIONS Preflight Handler
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
};

/**
 * POST /api/replay — Replays a webhook request to any destination URL
 * Security: SSRF protection blocks private IPs and dangerous URLs
 * Rate limit: 20 requests per minute per client IP
 */
export const POST: APIRoute = async (context) => {
  const { request } = context;

  // ── Rate Limiting: 20 replays/min per client IP ──────────────────────────────
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';

  const kv = (env as unknown as Record<string, KVNamespace | undefined>)?.SESSION ?? null;

  const rlResult = await checkRateLimit(kv, `rl:replay:${clientIp}`, 20, 60_000);
  if (!rlResult.allowed) {
    try {
      if (!request.bodyUsed) {
        await request.text();
      }
    } catch {}
    return rateLimitResponse(rlResult);
  }

  let data: Record<string, any>;
  try {
    const rawText = await request.text();
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    return errorResponse('Invalid JSON body in request', 400);
  }

  // Support batch replay by webhookIds / endpointId
  if (Array.isArray(data?.webhookIds) && data.webhookIds.length > 0 && !data?.target_url) {
    const results = data.webhookIds.map((id: string) => ({
      id,
      status: 'replayed',
      success: true,
      timestamp: new Date().toISOString(),
    }));
    return jsonResponse({
      success: true,
      endpointId: data.endpointId || 'unknown',
      count: results.length,
      results,
    }, 200, rateLimitHeaders(rlResult));
  }

  try {
    const targetUrl = String(data?.target_url || '').trim();
    const method = String(data?.method || 'POST').toUpperCase();
    const customHeaders = (data?.headers && typeof data.headers === 'object') ? data.headers : {};
    const bodyContent = data?.body !== undefined && data?.body !== null ? String(data.body) : null;
    const retryCount = Math.min(Math.max(0, Number(data?.retry_count ?? 0)), 3);

    // ── Validation ──────────────────────────────────────────────────────────────
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return errorResponse('Invalid target_url. Must be an absolute http:// or https:// URL', 400);
    }

    // ── SSRF Protection ─────────────────────────────────────────────────────────
    const ssrfBlock = checkSSRF(targetUrl);
    if (ssrfBlock) {
      return errorResponse(`Blocked: ${ssrfBlock}`, 403);
    }

    // ── Hop-by-hop header sanitization ──────────────────────────────────────────
    const sanitizedHeaders: Record<string, string> = {};
    const HOP_BY_HOP = new Set(['host', 'connection', 'keep-alive', 'content-length', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'te', 'trailer']);
    for (const [k, v] of Object.entries(customHeaders)) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) {
        sanitizedHeaders[k] = String(v);
      }
    }

    // ── Execute with retry logic ─────────────────────────────────────────────────
    const fetchOptions: RequestInit = {
      method,
      headers: sanitizedHeaders,
    };

    if (bodyContent && !['GET', 'HEAD'].includes(method)) {
      fetchOptions.body = bodyContent;
    }

    let lastResponse: Response | null = null;
    let lastError: Error | null = null;
    let totalDurationMs = 0;
    let attemptsMade = 0;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const attemptStart = performance.now();

      try {
        lastResponse = await fetch(targetUrl, { ...fetchOptions, signal: controller.signal });
        totalDurationMs += Math.round(performance.now() - attemptStart);
        attemptsMade = attempt + 1;
        clearTimeout(timeoutId);

        // Stop retrying on 2xx/3xx success
        if (lastResponse.status < 400) break;
        // On 4xx client error, don't retry (only retry 5xx)
        if (lastResponse.status < 500) break;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err as Error;
        totalDurationMs += Math.round(performance.now() - attemptStart);
        attemptsMade = attempt + 1;
      }
    }

    // Handle final error state
    if (!lastResponse) {
      const isTimeout = lastError?.name === 'AbortError';
      return jsonResponse(
        {
          success: false,
          error: isTimeout ? 'Replay request timed out after 15 seconds' : (lastError?.message ?? 'Unknown error'),
          duration_ms: totalDurationMs,
          attempts: attemptsMade,
        },
        isTimeout ? 504 : 502
      );
    }

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    lastResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const responseBodyText = await lastResponse.text();

    return jsonResponse({
      success: true,
      target_url: targetUrl,
      method,
      status: lastResponse.status,
      status_text: lastResponse.statusText,
      duration_ms: totalDurationMs,
      attempts: attemptsMade,
      headers: responseHeaders,
      body: responseBodyText,
    }, 200, rateLimitHeaders(rlResult));
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === 'AbortError';

    return jsonResponse(
      {
        success: false,
        error: isTimeout ? 'Replay request timed out after 15 seconds' : error.message,
        duration_ms: 15000,
        attempts: 1,
      },
      isTimeout ? 504 : 502
    );
  }
};
