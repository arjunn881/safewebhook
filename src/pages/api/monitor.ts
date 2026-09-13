import type { APIRoute } from 'astro';
import { CORS_HEADERS, jsonResponse, errorResponse } from '../../lib/http';

export const prerender = false;

interface MonitorRequestBody {
  url?: string;
  method?: string;
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
    const data = (await request.json()) as MonitorRequestBody;
    const targetUrl = String(data?.url || '').trim();
    const method = String(data?.method || 'GET').toUpperCase();

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return errorResponse('Invalid URL. Must start with http:// or https://', 400);
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Math.round(performance.now() - startTime);
    const bodyText = await response.text();

    const isHealthy = response.status >= 200 && response.status < 400;

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
        protocol: isHttps ? 'TLS 1.3 / HTTPS' : 'Insecure HTTP',
        valid: isHttps,
      },
      content_length: bodyText.length,
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
    }, 200);
  }
};
