import type { APIRoute } from 'astro';
import { CORS_HEADERS, jsonResponse, errorResponse, readRequestBody } from '../../lib/http';
import { checkSSRF } from '../../lib/ssrf_guard';

export const prerender = false;

interface MonitorRequestBody {
  url?: string;
  method?: string;
}

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);

async function readBodyPreview(response: Response, maxBytes = 8192): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - total;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (chunk.byteLength < value.byteLength) break;
    }
  } finally {
    try { await reader.cancel(); } catch { /* response may already be closed */ }
  }

  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
};

/**
 * GET /api/monitor — Returns system operational status for uptime monitors
 */
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: true,
      status: 'operational',
      service: 'safewebhook',
      timestamp: new Date().toISOString(),
      runtime: 'cloudflare-workers',
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
};

/**
 * Edge Uptime & SSL Monitor Check API
 * Performs automated health check ping and SSL status validation
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    let rawBody: string | null;
    try {
      rawBody = (await readRequestBody(request, 32 * 1024)).bodyText;
    } catch (err) {
      if (err instanceof Error && err.message.includes('Payload too large')) {
        return errorResponse('Monitor request is too large. Maximum body size is 32KB.', 413);
      }
      return errorResponse('Invalid monitor request body.', 400);
    }
    let data: MonitorRequestBody;
    try {
      data = (rawBody ? JSON.parse(rawBody) : {}) as MonitorRequestBody;
    } catch {
      return errorResponse('Invalid JSON body in monitor request.', 400);
    }
    const targetUrl = String(data?.url || '').trim();
    const method = String(data?.method || 'GET').toUpperCase();

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return errorResponse('Invalid URL. Must start with http:// or https://', 400);
    }
    if (!ALLOWED_METHODS.has(method)) {
      return errorResponse('Invalid monitor method. Use GET, HEAD, or POST.', 400);
    }

    const ssrfBlock = checkSSRF(targetUrl);
    if (ssrfBlock) {
      return errorResponse(`Blocked: ${ssrfBlock}`, 403);
    }

    const isHttps = targetUrl.startsWith('https://');
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method,
        headers: {
          'User-Agent': 'SafeWebhook-UptimeMonitor/1.0 (+https://safewebhook.com/docs)',
          'Accept': '*/*',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Math.round(performance.now() - startTime);
    const bodyText = await readBodyPreview(response);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const isHealthy = response.status >= 200 && response.status < 400;
    const redirectLocation = response.headers.get('location');
    let reportedFinalUrl = targetUrl;
    if (redirectLocation) {
      try { reportedFinalUrl = new URL(redirectLocation, targetUrl).toString(); } catch { /* keep target */ }
    }

    return jsonResponse({
      success: true,
      url: targetUrl,
      method,
      status: response.status,
      status_text: response.statusText,
      healthy: isHealthy,
      response_time_ms: durationMs,
      ssl: {
        enabled: isHttps,
        protocol: isHttps ? 'HTTPS' : 'Insecure HTTP',
        valid: null,
      },
      redirected: response.redirected || (response.status >= 300 && response.status < 400),
      final_url: response.url || reportedFinalUrl,
      redirect_location: redirectLocation,
      headers: responseHeaders,
      body_preview: bodyText,
      content_length: Number(response.headers.get('content-length')) || bodyText.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === 'AbortError';

    return jsonResponse({
      success: false,
      healthy: false,
      error: isTimeout ? 'Health check timed out after 10 seconds' : error.message,
      response_time_ms: 10000,
      timestamp: new Date().toISOString(),
    }, isTimeout ? 504 : 502);
  }
};
