import type { APIRoute } from 'astro';
import { safeGetDatabase, getWebhookHistory, deleteEndpointWebhooks } from '../../../lib/db';
import { getWebhookPayloads, clearWebhookPayloads } from '../../../lib/kv_store';
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
 * GET Handler to retrieve webhook entries for an endpoint with pagination and filtering
 * Query Params:
 *  - page: number (default: 1)
 *  - limit: number (default: 50, max: 100)
 *  - method: string (e.g. "POST", "GET", "ALL")
 *  - search: string (substring search across headers and body)
 *  - from: string (ISO timestamp start)
 *  - to: string (ISO timestamp end)
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
    const urlObj = new URL(url);
    const limitParam = urlObj.searchParams.get('limit');
    const pageParam = urlObj.searchParams.get('page');
    const methodParam = urlObj.searchParams.get('method')?.toUpperCase();
    const searchParam = urlObj.searchParams.get('search')?.toLowerCase();
    const fromParam = urlObj.searchParams.get('from');
    const toParam = urlObj.searchParams.get('to');

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const safeLimit = Math.min(Math.max(1, isNaN(limit) ? 50 : limit), 100);
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const safePage = Math.max(1, isNaN(page) ? 1 : page);

    const itemsMap = new Map<string, WebhookHistoryItem>();

    // 1. Fetch KV & In-Memory events first (most real-time)
    const kvEvents = await getWebhookPayloads(endpointId!);
    for (const ev of kvEvents) {
      itemsMap.set(ev.id, {
        id: ev.id,
        endpoint_id: ev.endpoint_id,
        timestamp: ev.timestamp,
        method: ev.method,
        headers: ev.headers || {},
        body: ev.body || null,
        size_bytes: ev.size_bytes,
      });
    }

    // 2. Fetch D1 Database records if bound (fetch up to 100 for merging/filtering)
    const db = safeGetDatabase(context);
    if (db) {
      const rawRows = await getWebhookHistory(db, endpointId!, 100);
      for (const row of rawRows) {
        if (!itemsMap.has(row.id)) {
          let parsedHeaders: Record<string, string> = {};
          try {
            parsedHeaders = JSON.parse(row.headers || '{}');
          } catch {
            parsedHeaders = { 'raw-headers': row.headers };
          }
          const bodySize = row.body ? new TextEncoder().encode(row.body).length : 0;
          itemsMap.set(row.id, {
            id: row.id,
            endpoint_id: row.endpoint_id,
            timestamp: row.timestamp,
            method: row.method,
            headers: parsedHeaders,
            body: row.body,
            size_bytes: bodySize,
          });
        }
      }
    }

    // Filter items
    let allItems = Array.from(itemsMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (methodParam && methodParam !== 'ALL') {
      allItems = allItems.filter((item) => item.method.toUpperCase() === methodParam);
    }

    if (fromParam) {
      allItems = allItems.filter((item) => item.timestamp >= fromParam);
    }

    if (toParam) {
      allItems = allItems.filter((item) => item.timestamp <= toParam);
    }

    if (searchParam) {
      allItems = allItems.filter((item) => {
        const bodyMatch = item.body?.toLowerCase().includes(searchParam) ?? false;
        const headerMatch = Object.entries(item.headers).some(([k, v]) =>
          k.toLowerCase().includes(searchParam) || String(v).toLowerCase().includes(searchParam)
        );
        const methodMatch = item.method.toLowerCase().includes(searchParam);
        return bodyMatch || headerMatch || methodMatch;
      });
    }

    const totalFiltered = allItems.length;
    const startIndex = (safePage - 1) * safeLimit;
    const paginatedItems = allItems.slice(startIndex, startIndex + safeLimit);

    const responseData: WebhookHistoryResponse & {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    } = {
      success: true,
      endpoint_id: endpointId!,
      count: paginatedItems.length,
      total: totalFiltered,
      page: safePage,
      limit: safeLimit,
      total_pages: Math.ceil(totalFiltered / safeLimit) || 1,
      webhooks: paginatedItems,
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
 * DELETE Handler to clear all history for a given endpoint from both D1 & KV
 */
export const DELETE: APIRoute = async (context) => {
  const { params } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id', 400);
  }

  try {
    // 1. Clear KV & memory payloads
    await clearWebhookPayloads(endpointId!);

    // 2. Clear D1 records if available
    const db = safeGetDatabase(context);
    let deletedCount = 0;
    if (db) {
      deletedCount = await deleteEndpointWebhooks(db, endpointId!);
    }

    return jsonResponse({
      success: true,
      endpoint_id: endpointId,
      deleted_count: deletedCount,
      message: `Cleared webhook records for endpoint "${endpointId}"`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(
      `Failed to clear history: ${error.message || 'Internal edge error'}`,
      500
    );
  }
};

/**
 * POST Handler fallback for clients/proxies that cannot issue cross-origin DELETE
 */
export const POST: APIRoute = async (context) => {
  const urlObj = new URL(context.url);
  const action = urlObj.searchParams.get('action');
  if (action === 'clear' || action === 'delete') {
    return DELETE(context);
  }

  try {
    const body = await context.request.json() as Record<string, any>;
    if (body?.action === 'clear' || body?.action === 'delete') {
      return DELETE(context);
    }
  } catch {}

  return errorResponse('Method Not Allowed. Use DELETE to clear history, or POST with ?action=clear.', 405);
};

