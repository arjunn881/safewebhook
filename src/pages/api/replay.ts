import type { APIRoute } from 'astro';
import { CORS_HEADERS, jsonResponse, errorResponse } from '../../lib/http';

export const prerender = false;

interface ReplayRequestBody {
  target_url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
}

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
 * POST Handler: Replays a webhook request to any destination URL
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = (await request.json()) as ReplayRequestBody;
    const targetUrl = String(data?.target_url || '').trim();
    const method = String(data?.method || 'POST').toUpperCase();
    const customHeaders = (data?.headers && typeof data.headers === 'object') ? data.headers : {};
    const bodyContent = data?.body !== undefined && data?.body !== null ? String(data.body) : null;

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return errorResponse('Invalid target_url. Must be an absolute http:// or https:// URL', 400);
    }

    // Filter out forbidden hop-by-hop headers
    const sanitizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(customHeaders)) {
      const lower = k.toLowerCase();
      if (['host', 'connection', 'keep-alive', 'content-length', 'transfer-encoding'].includes(lower)) {
        continue;
      }
      sanitizedHeaders[k] = String(v);
    }

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let fetchOptions: RequestInit = {
      method,
      headers: sanitizedHeaders,
      signal: controller.signal,
    };

    if (bodyContent && !['GET', 'HEAD'].includes(method)) {
      fetchOptions.body = bodyContent;
    }

    let response: Response;
    try {
      response = await fetch(targetUrl, fetchOptions);
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Math.round(performance.now() - startTime);

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const responseBodyText = await response.text();

    return jsonResponse({
      success: true,
      target_url: targetUrl,
      method,
      status: response.status,
      status_text: response.statusText,
      duration_ms: durationMs,
      headers: responseHeaders,
      body: responseBodyText,
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === 'AbortError';

    return jsonResponse(
      {
        success: false,
        error: isTimeout ? 'Replay request timed out after 15 seconds' : error.message,
        duration_ms: 15000,
      },
      isTimeout ? 504 : 502
    );
  }
};
