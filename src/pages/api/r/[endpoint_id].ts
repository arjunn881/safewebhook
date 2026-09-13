import type { APIRoute } from 'astro';
import { broadcastWebhook, getEndpointConfig, getEndpointWorkflow } from '../../../lib/streams';
import { saveWebhookPayload } from '../../../lib/kv_store';
import { safeGetDatabase, insertWebhook } from '../../../lib/db';
import {
  CORS_HEADERS,
  extractHeaders,
  isValidEndpointId,
  readRequestBody,
  errorResponse,
} from '../../../lib/http';
import { checkRateLimit, rateLimitResponse, rateLimitHeaders } from '../../../lib/rate_limit';
import { checkSSRF } from '../../../lib/ssrf_guard';
import { env } from 'cloudflare:workers';

export const prerender = false;

/**
 * Universal Inbound Webhook Receiver
 * Stateless real-time edge router with dynamic custom responses, latency simulation & automated workflows
 */
async function handleInboundWebhook(context: Parameters<APIRoute>[0]): Promise<Response> {
  const { params, request, url } = context;
  // Cloudflare Workers execution context for background tasks (waitUntil)
  // Astro v6+: use context.locals.cfContext (runtime.ctx was removed in v6)
  const ctx = (context.locals as { cfContext?: ExecutionContext }).cfContext;
  const endpointId = params.endpoint_id;

  // 1. Handle preflight CORS OPTIONS requests immediately
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // 2. Validate endpoint identifier format
  if (!isValidEndpointId(endpointId)) {
    return errorResponse(
      'Invalid endpoint_id. Must be 1-64 alphanumeric characters, dashes, or underscores.',
      400
    );
  }

  // 3. Extract incoming URL query parameters
  const urlObj = new URL(url);
  const queryParams: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // 4. Per-endpoint rate limiting: default 100 requests/min (supports ?rate_limit=N for custom throttling/testing)
  const rateLimitParam = queryParams['rate_limit'];
  const parsedLimit = rateLimitParam ? parseInt(rateLimitParam, 10) : NaN;
  const limit = (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 5000) ? parsedLimit : 100;

  const kv = (env as unknown as Record<string, KVNamespace | undefined>)?.SESSION ?? null;
  const rlResult = await checkRateLimit(kv, `rl:inbound:${endpointId}`, limit, 60_000);
  if (!rlResult.allowed) {
    try {
      if (!request.bodyUsed) {
        await request.text();
      }
    } catch {}
    return rateLimitResponse(rlResult);
  }

  try {
    // 5. Extract raw body text safely with hard 1MB limit (returns 413 on oversize)
    let bodyText: string | null;
    let byteSize: number;
    try {
      const result = await readRequestBody(request, 1 * 1024 * 1024);
      bodyText = result.bodyText;
      byteSize = result.byteSize;
    } catch (sizeErr: unknown) {
      const err = sizeErr as Error;
      if (err.message.includes('Payload too large')) {
        return errorResponse('Payload too large. Maximum accepted body size is 1MB.', 413);
      }
      throw sizeErr;
    }

    // 6. Extract and normalize all request headers into a plain JSON object
    const headersMap = extractHeaders(request);

    // 6. Detect Content Format & Signature Providers
    const contentType = (headersMap['content-type'] || '').toLowerCase();
    let format = 'raw';
    if (contentType.includes('application/json')) format = 'json';
    else if (contentType.includes('application/xml') || contentType.includes('text/xml')) format = 'xml';
    else if (contentType.includes('application/x-www-form-urlencoded')) format = 'form';
    else if (contentType.includes('multipart/form-data')) format = 'multipart';
    else if (contentType.includes('text/html')) format = 'html';

    // Detect cryptographic signature providers
    let signatureProvider: string | null = null;
    if (headersMap['stripe-signature']) signatureProvider = 'Stripe';
    else if (headersMap['x-hub-signature-256'] || headersMap['x-hub-signature']) signatureProvider = 'GitHub';
    else if (headersMap['x-shopify-hmac-sha256']) signatureProvider = 'Shopify';
    else if (headersMap['x-slack-signature']) signatureProvider = 'Slack';
    else if (headersMap['x-twilio-signature']) signatureProvider = 'Twilio';
    else if (headersMap['webhook-signature'] || headersMap['svix-signature'] || headersMap['svix-id']) signatureProvider = 'Svix';
    else if (headersMap['x-signature-sha256'] || headersMap['x-lemonsqueezy-signature']) signatureProvider = 'LemonSqueezy';
    else if (headersMap['x-razorpay-signature']) signatureProvider = 'Razorpay';
    else if (headersMap['paypal-transmission-sig'] || headersMap['paypal-auth-algo']) signatureProvider = 'PayPal';
    else if (headersMap['linear-signature']) signatureProvider = 'Linear';
    else if (headersMap['clerk-signature']) signatureProvider = 'Clerk';
    else if (headersMap['x-supabase-signature']) signatureProvider = 'Supabase';

    const clientIp = headersMap['cf-connecting-ip'] ||
      headersMap['x-forwarded-for']?.split(',')[0].trim() ||
      headersMap['x-real-ip'] ||
      '127.0.0.1';

    const webhookId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // 7. Bundle into unified webhook payload envelope
    const payload = {
      id: webhookId,
      endpoint_id: endpointId!,
      timestamp,
      method: request.method.toUpperCase(),
      query_params: queryParams,
      headers: headersMap,
      body: bodyText || '',
      size_bytes: byteSize,
      format,
      signature_provider: signatureProvider,
      client_ip: clientIp,
      url: urlObj.toString(),
      path: urlObj.pathname,
      is_email: false,
      email: null,
    };

    // 8. Instantly forward to active in-memory SSE stream listeners
    const { delivered, recipientCount } = broadcastWebhook(endpointId!, payload);

    // Save to in-memory store (sync) + schedule KV write via waitUntil (non-blocking).
    // NOT awaiting the KV write here is critical — wrangler 4.x miniflare crashes when
    // KV loopback I/O from one request overlaps with the next. By deferring via waitUntil,
    // the response is returned before KV completes, preventing the overlap.
    const kvWrite = saveWebhookPayload(endpointId!, payload);
    if (ctx?.waitUntil) {
      ctx.waitUntil(kvWrite);
    }
    // Note: if ctx is unavailable (rare edge case), the KV write still runs as a
    // background IIFE from inside saveWebhookPayload — in-memory store is always updated.

    // Persist to Cloudflare D1 Database
    const db = safeGetDatabase(context);
    if (db) {
      const d1Promise = insertWebhook(db, {
        id: webhookId,
        endpoint_id: endpointId!,
        timestamp,
        method: payload.method,
        headers: JSON.stringify(headersMap),
        body: bodyText || null,
      }).catch((err) => console.error('[D1 Inbound Insert Error]', err));

      if (ctx?.waitUntil) {
        ctx.waitUntil(d1Promise);
      }
    }

    // 9. Execute automated workflows (Auto-forwarding / Slack notifications)
    const workflow = getEndpointWorkflow(endpointId!);
    if (workflow && workflow.enabled) {
      // Auto-Forwarding proxy (with SSRF protection) — registered via waitUntil
      if (workflow.autoForwardUrl) {
        const ssrfBlock = checkSSRF(workflow.autoForwardUrl);
        if (!ssrfBlock) {
          const fwdFetch = fetch(workflow.autoForwardUrl!, {
            method: payload.method,
            headers: {
              ...headersMap,
              'X-Forwarded-By': 'SafeWebhook-Workflow-Engine',
              'X-Safewebhook-Endpoint': endpointId!,
            },
            body: ['GET', 'HEAD'].includes(payload.method) ? undefined : bodyText ?? undefined,
          }).catch(() => { /* Non-blocking auto-forward errors are suppressed */ });
          if (ctx?.waitUntil) ctx.waitUntil(fwdFetch);
        } else {
          console.warn(`[Workflow SSRF Block] endpoint=${endpointId} url=${workflow.autoForwardUrl} reason=${ssrfBlock}`);
        }
      }

      // Notify external Discord / Slack webhook — registered via waitUntil
      if (workflow.notifyWebhookUrl) {
        const notifyFetch = fetch(workflow.notifyWebhookUrl!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**[EVENT] New Webhook Received [${payload.method}]**\nEndpoint: \`${endpointId}\`\nSize: ${byteSize} bytes\nSignature: ${signatureProvider || 'None'}`,
            text: `[EVENT] New Webhook [${payload.method}] on ${endpointId}`,
          }),
        }).catch(() => { /* Notification errors are suppressed */ });
        if (ctx?.waitUntil) ctx.waitUntil(notifyFetch);
      }
    }

    // 10. Resolve configured custom response & simulated delay
    const config = getEndpointConfig(endpointId!);

    // Allow query parameter overrides if passed (e.g. ?status=201&delay=500)
    let statusCode = config.statusCode;
    if (queryParams['status']) {
      const parsedStatus = parseInt(queryParams['status'], 10);
      if (!isNaN(parsedStatus) && parsedStatus >= 100 && parsedStatus <= 599) {
        statusCode = parsedStatus;
      }
    }

    let delayMs = config.delayMs;
    if (queryParams['delay']) {
      const parsedDelay = parseInt(queryParams['delay'], 10);
      if (!isNaN(parsedDelay) && parsedDelay >= 0 && parsedDelay <= 10000) {
        delayMs = parsedDelay;
      }
    }

    // Apply simulated network delay if configured
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Construct response headers
    const responseHeaders: Record<string, string> = {
      ...CORS_HEADERS,
      'Content-Type': config.contentType,
      'X-Webhook-Delivered': delivered ? 'true' : 'false',
      'X-Webhook-Recipients': String(recipientCount),
      'X-Webhook-Simulated-Delay': `${delayMs}ms`,
      ...rateLimitHeaders(rlResult),
      ...config.responseHeaders,
    };

    return new Response(config.responseBody, {
      status: statusCode,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Inbound Webhook Error on ${request.method}]:`, error.message, error.stack);
    return errorResponse(`Failed to process inbound webhook: ${error.message}`, 500);
  }
}

export const ALL: APIRoute = handleInboundWebhook;
export const GET: APIRoute = handleInboundWebhook;
export const POST: APIRoute = handleInboundWebhook;
export const PUT: APIRoute = handleInboundWebhook;
export const DELETE: APIRoute = handleInboundWebhook;
export const PATCH: APIRoute = handleInboundWebhook;
export const OPTIONS: APIRoute = handleInboundWebhook;
