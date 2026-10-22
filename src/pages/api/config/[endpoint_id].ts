import type { APIRoute } from 'astro';
import { getEndpointConfigAsync, setEndpointConfigAsync } from '../../../lib/streams';
import { isValidEndpointId, CORS_HEADERS, jsonResponse, errorResponse, readRequestBody } from '../../../lib/http';

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

  const config = await getEndpointConfigAsync(endpointId!);
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
    let rawBody: string | null;
    try {
      rawBody = (await readRequestBody(request, 128 * 1024)).bodyText;
    } catch (err) {
      if (err instanceof Error && err.message.includes('Payload too large')) {
        return errorResponse('Configuration request is too large. Maximum body size is 128KB.', 413);
      }
      return errorResponse('Invalid configuration request body.', 400);
    }
    const body = (rawBody ? JSON.parse(rawBody) : {}) as ConfigRequestBody;
    if (body.statusCode !== undefined &&
      (!Number.isInteger(body.statusCode) || body.statusCode < 200 || body.statusCode > 599)) {
      return errorResponse('Status code must be an integer between 200 and 599.', 400);
    }
    if (body.delayMs !== undefined &&
      (!Number.isFinite(body.delayMs) || body.delayMs < 0 || body.delayMs > 10000)) {
      return errorResponse('Delay must be between 0 and 10000 milliseconds.', 400);
    }

    const updated = await setEndpointConfigAsync(endpointId!, {
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
