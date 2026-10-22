import type { APIRoute } from 'astro';
import { getEndpointWorkflowAsync, setEndpointWorkflowAsync } from '../../../lib/streams';
import { isValidEndpointId, CORS_HEADERS, jsonResponse, errorResponse, readRequestBody } from '../../../lib/http';
import { checkSSRF } from '../../../lib/ssrf_guard';

export const prerender = false;

interface WorkflowRequestBody {
  enabled?: boolean;
  autoForwardUrl?: string;
  jsTransformCode?: string;
  filterCondition?: string;
  notifyWebhookUrl?: string;
}

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
 * GET Handler: Retrieve current workflow rules
 */
export const GET: APIRoute = async (context) => {
  const { params } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  const workflow = await getEndpointWorkflowAsync(endpointId!);
  return jsonResponse({
    success: true,
    endpoint_id: endpointId,
    workflow,
  });
};

/**
 * POST/PUT Handler: Update workflow rules
 */
async function handleUpdateWorkflow(context: Parameters<APIRoute>[0]): Promise<Response> {
  const { params, request } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  try {
    let rawBody: string | null;
    try {
      rawBody = (await readRequestBody(request, 64 * 1024)).bodyText;
    } catch (err) {
      if (err instanceof Error && err.message.includes('Payload too large')) {
        return errorResponse('Workflow request is too large. Maximum body size is 64KB.', 413);
      }
      return errorResponse('Invalid workflow request body.', 400);
    }
    const body = (rawBody ? JSON.parse(rawBody) : {}) as WorkflowRequestBody;
    const urls = [body.autoForwardUrl, body.notifyWebhookUrl].filter(Boolean).map((value) => String(value).trim());
    for (const target of urls) {
      const blockReason = checkSSRF(target);
      if (blockReason) {
        return errorResponse(`Blocked workflow URL: ${blockReason}`, 403);
      }
    }

    const updated = await setEndpointWorkflowAsync(endpointId!, {
      enabled: body.enabled,
      autoForwardUrl: body.autoForwardUrl,
      jsTransformCode: body.jsTransformCode,
      filterCondition: body.filterCondition,
      notifyWebhookUrl: body.notifyWebhookUrl,
    });

    return jsonResponse({
      success: true,
      message: 'Workflow rules updated',
      endpoint_id: endpointId,
      workflow: updated,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(`Failed to parse workflow config: ${error.message}`, 400);
  }
}

export const POST: APIRoute = handleUpdateWorkflow;
export const PUT: APIRoute = handleUpdateWorkflow;
