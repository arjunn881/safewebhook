import type { APIRoute } from 'astro';
import { getWebhookHistory, safeGetDatabase } from '../../../lib/db';
import { getWebhookPayloads } from '../../../lib/kv_store';
import { jsonResponse, errorResponse, isValidEndpointId, CORS_HEADERS } from '../../../lib/http';

export const prerender = false;

/**
 * OPTIONS Preflight Handler
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
};

/**
 * GET /api/stats/:endpoint_id
 * Returns real-time statistics for an endpoint:
 * - Total request count
 * - Requests in last hour / last 24h
 * - Method breakdown (POST/GET/PUT/etc. counts)
 * - Detected signature providers
 * - Average payload size
 * - First and last seen timestamps
 */
export const GET: APIRoute = async (context) => {
  const { params } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  try {
    // Try D1 first for accurate historic counts
    const db = safeGetDatabase(context);
    let records = db ? await getWebhookHistory(db, endpointId!, 100) : [];

    // Fall back to KV/in-memory if D1 not available
    if (records.length === 0) {
      const kvPayloads = await getWebhookPayloads(endpointId!);
      records = kvPayloads.map((p) => ({
        id: p.id,
        endpoint_id: p.endpoint_id,
        timestamp: p.timestamp,
        method: p.method,
        headers: JSON.stringify(p.headers),
        body: p.body ?? null,
      }));
    }

    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Method breakdown
    const methodCounts: Record<string, number> = {};
    let totalSizeBytes = 0;
    let lastSeen: string | null = null;
    let firstSeen: string | null = null;
    let recentHour = 0;
    let recentDay = 0;
    const signatureProviders: Record<string, number> = {};

    for (const record of records) {
      // Method counts
      methodCounts[record.method] = (methodCounts[record.method] ?? 0) + 1;

      // Size estimate (body length + headers length)
      const bodyLen = record.body?.length ?? 0;
      const headersLen = record.headers?.length ?? 0;
      totalSizeBytes += bodyLen + headersLen;

      // Time windows
      if (record.timestamp >= oneHourAgo) recentHour++;
      if (record.timestamp >= oneDayAgo) recentDay++;

      // First/last seen
      if (!lastSeen || record.timestamp > lastSeen) lastSeen = record.timestamp;
      if (!firstSeen || record.timestamp < firstSeen) firstSeen = record.timestamp;

      // Try to extract signature provider from headers
      try {
        const headers = typeof record.headers === 'string'
          ? JSON.parse(record.headers)
          : record.headers;

        let provider: string | null = null;
        if (headers['stripe-signature']) provider = 'Stripe';
        else if (headers['x-hub-signature-256'] || headers['x-hub-signature']) provider = 'GitHub';
        else if (headers['x-shopify-hmac-sha256']) provider = 'Shopify';
        else if (headers['x-slack-signature']) provider = 'Slack';
        else if (headers['x-twilio-signature']) provider = 'Twilio';
        else if (headers['svix-signature'] || headers['webhook-signature']) provider = 'Svix';
        else if (headers['x-lemonsqueezy-signature']) provider = 'LemonSqueezy';
        else if (headers['paypal-transmission-sig']) provider = 'PayPal';

        if (provider) {
          signatureProviders[provider] = (signatureProviders[provider] ?? 0) + 1;
        }
      } catch {
        // ignore header parse errors
      }
    }

    const totalCount = records.length;
    const avgSizeBytes = totalCount > 0 ? Math.round(totalSizeBytes / totalCount) : 0;

    return jsonResponse({
      endpoint_id: endpointId,
      total_requests: totalCount,
      requests_last_hour: recentHour,
      requests_last_24h: recentDay,
      method_breakdown: methodCounts,
      signature_providers: signatureProviders,
      avg_payload_size_bytes: avgSizeBytes,
      first_seen: firstSeen,
      last_seen: lastSeen,
      computed_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(`Failed to compute endpoint stats: ${error.message}`, 500);
  }
};
