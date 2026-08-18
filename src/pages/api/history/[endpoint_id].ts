import type { APIRoute } from 'astro';
import { getDatabase, getWebhookHistory, deleteEndpointWebhooks } from '../../../lib/db';
import {
  CORS_HEADERS,
  isValidEndpointId,
  jsonResponse,
  errorResponse,
} from '../../../lib/http';
import type {
  WebhookHistoryItem,
  WebhookHistoryResponse,
} from '../../../types/database';

export const prerender = false;

/**
 * OPTIONS Handler for CORS Preflight requests
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

/**
 * GET Handler to retrieve the last 50 webhook entries for an endpoint
 */
export const GET: APIRoute = async (context) => {
  const { params, url } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse(
      'Invalid or missing endpoint_id. Must be 1-64 alphanumeric characters, dashes, or underscores.',
      400
    );
  }

  try {
    // Optional limit query parameter (default 50, max 100)
    const urlObj = new URL(url);
    const limitParam = urlObj.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const db = getDatabase(context);
    const rawRows = await getWebhookHistory(db, endpointId!, isNaN(limit) ? 50 : limit);

    // Transform rows: parse serialized headers JSON safely
    const formattedWebhooks: WebhookHistoryItem[] = rawRows.map((row) => {
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(row.headers || '{}');
      } catch {
        parsedHeaders = { 'raw-headers': row.headers };
      }

      const bodySize = row.body ? new TextEncoder().encode(row.body).length : 0;

      return {
        id: row.id,
        endpoint_id: row.endpoint_id,
        timestamp: row.timestamp,
        method: row.method,
        headers: parsedHeaders,
        body: row.body,
        size_bytes: bodySize,
      };
    });

    const responseData: WebhookHistoryResponse = {
      success: true,
      endpoint_id: endpointId!,
      count: formattedWebhooks.length,
      webhooks: formattedWebhooks,
    };

    return jsonResponse(responseData, 200);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[History API Error] Endpoint: ${endpointId}`, error);
    return errorResponse(
      `Failed to retrieve webhook history: ${error.message || 'Internal edge error'}`,
      500
    );
  }
};

/**
 * DELETE Handler to optionally clear all history for a given endpoint
 */
export const DELETE: APIRoute = async (context) => {
  const { params } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id', 400);
  }

  try {
    const db = getDatabase(context);
    const deletedCount = await deleteEndpointWebhooks(db, endpointId!);

    return jsonResponse({
      success: true,
      endpoint_id: endpointId,
      deleted_count: deletedCount,
      message: `Cleared ${deletedCount} webhook records for endpoint "${endpointId}"`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(
      `Failed to clear history: ${error.message || 'Internal edge error'}`,
      500
    );
  }
};
