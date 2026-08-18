import type { APIRoute } from 'astro';
import { getWebhookPayloads, clearWebhookPayloads } from '../../../lib/kv_store';
import { CORS_HEADERS, isValidEndpointId, jsonResponse, errorResponse } from '../../../lib/http';

export const prerender = false;

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    },
  });
};

/**
 * GET /api/poll/[endpoint_id]
 * Returns all recent webhooks captured for this endpoint
 */
export const GET: APIRoute = async (context) => {
  const { params } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id', 400);
  }

  const payloads = await getWebhookPayloads(endpointId!);

  return jsonResponse({
    endpoint_id: endpointId,
    count: payloads.length,
    events: payloads,
  });
};

/**
 * DELETE /api/poll/[endpoint_id]
 * Clears all captured webhooks for this endpoint
 */
export const DELETE: APIRoute = async (context) => {
  const { params } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id', 400);
  }

  await clearWebhookPayloads(endpointId!);

  return jsonResponse({ success: true, message: 'Logs cleared' });
};
