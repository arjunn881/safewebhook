import type { APIRoute } from 'astro';
import { getEndpointWorkflow, setEndpointWorkflow } from '../../../lib/streams';
import { isValidEndpointId, CORS_HEADERS, jsonResponse, errorResponse } from '../../../lib/http';

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

  const workflow = getEndpointWorkflow(endpointId!);
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
    const body = (await request.json()) as WorkflowRequestBody;
    const updated = setEndpointWorkflow(endpointId!, {
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
