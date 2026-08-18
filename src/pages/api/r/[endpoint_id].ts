import type { APIRoute } from 'astro';
import { broadcastWebhook, getEndpointConfig, getEndpointWorkflow } from '../../../lib/streams';
import { saveWebhookPayload } from '../../../lib/kv_store';
import {
  CORS_HEADERS,
  extractHeaders,
  isValidEndpointId,
  readRequestBody,
  errorResponse,
} from '../../../lib/http';

export const prerender = false;

/**
 * Universal Inbound Webhook Receiver
 * Stateless real-time edge router with dynamic custom responses, latency simulation & automated workflows
 */
async function handleInboundWebhook(context: Parameters<APIRoute>[0]): Promise<Response> {
  const { params, request, url } = context;
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

  try {
    // 3. Extract raw body text safely with memory limits
    const { bodyText, byteSize } = await readRequestBody(request);

    // 4. Extract and normalize all request headers into a plain JSON object
    const headersMap = extractHeaders(request);

    // 5. Extract incoming URL query parameters
    const urlObj = new URL(url);
    const queryParams: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

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
    else if (headersMap['webhook-signature'] || headersMap['svix-signature']) signatureProvider = 'Svix';

    // 7. Bundle into unified webhook payload envelope
    const payload = {
      id: crypto.randomUUID(),
      endpoint_id: endpointId!,
      timestamp: new Date().toISOString(),
      method: request.method.toUpperCase(),
      query_params: queryParams,
      headers: headersMap,
      body: bodyText || '',
      size_bytes: byteSize,
      format,
      signature_provider: signatureProvider,
    };

    // 8. Instantly forward to active in-memory SSE stream listeners
    const { delivered, recipientCount } = broadcastWebhook(endpointId!, payload);

    // Save to Cloudflare KV & memory store for multi-isolate synchronization
    await saveWebhookPayload(endpointId!, payload);

    // 9. Execute automated workflows (Auto-forwarding / Slack notifications)
    const workflow = getEndpointWorkflow(endpointId!);
    if (workflow && workflow.enabled) {
      // Auto-Forwarding proxy
      if (workflow.autoForwardUrl) {
        fetch(workflow.autoForwardUrl, {
          method: payload.method,
          headers: {
            ...headersMap,
            'X-Forwarded-By': 'WebhookTester-Workflow-Engine',
          },
          body: ['GET', 'HEAD'].includes(payload.method) ? undefined : bodyText,
        }).catch(() => {
          // Non-blocking auto-forward error suppression
        });
      }

      // Notify external Discord / Slack webhook
      if (workflow.notifyWebhookUrl) {
        fetch(workflow.notifyWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **New Webhook Event [${payload.method}]**\nEndpoint: \`${endpointId}\`\nSize: ${byteSize} bytes\nSignature: ${signatureProvider || 'None'}`,
            text: `New Webhook Event [${payload.method}] on ${endpointId}`,
          }),
        }).catch(() => {});
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
      ...config.responseHeaders,
    };

    return new Response(config.responseBody, {
      status: statusCode,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const error = err as Error;
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
