import type { APIRoute } from 'astro';
import { getEndpointConfig, setEndpointConfig } from '../../../lib/streams';
import { isValidEndpointId, CORS_HEADERS, jsonResponse, errorResponse } from '../../../lib/http';

export const prerender = false;

interface ConfigRequestBody {
  statusCode?: number;
  contentType?: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  delayMs?: number;
}

/**
 * OPTIONS Preflight Handler
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    },
  });
};

/**
 * GET Handler: Retrieve current custom response settings for endpoint
 */
export const GET: APIRoute = async (context) => {
  const { params } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  const config = getEndpointConfig(endpointId!);
  return jsonResponse({
    success: true,
    endpoint_id: endpointId,
    config,
  });
};

/**
 * POST/PUT Handler: Update custom response status code, headers, body, or delay
 */
async function handleUpdateConfig(context: Parameters<APIRoute>[0]): Promise<Response> {
  const { params, request } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  try {
    const body = (await request.json()) as ConfigRequestBody;
    const updated = setEndpointConfig(endpointId!, {
      statusCode: body.statusCode,
      contentType: body.contentType,
      responseBody: body.responseBody,
      responseHeaders: body.responseHeaders,
      delayMs: body.delayMs,
    });

    return jsonResponse({
      success: true,
      message: 'Custom response configuration updated',
      endpoint_id: endpointId,
      config: updated,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(`Failed to parse configuration: ${error.message}`, 400);
  }
}

export const POST: APIRoute = handleUpdateConfig;
export const PUT: APIRoute = handleUpdateConfig;
