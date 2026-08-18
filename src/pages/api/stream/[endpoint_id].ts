import type { APIRoute } from 'astro';
import { registerStream, unregisterStream, sendKeepAlive } from '../../../lib/streams';
import { isValidEndpointId, CORS_HEADERS, errorResponse } from '../../../lib/http';

export const prerender = false;

/**
 * OPTIONS Preflight Handler for SSE Connection
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
};

/**
 * GET Handler establishing real-time Server-Sent Events (SSE) stream
 */
export const GET: APIRoute = async (context) => {
  const { params, request } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let activeController: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      activeController = controller;

      // 1. Register controller in global in-memory activeStreams map
      registerStream(endpointId!, controller);

      // 2. Send initial SSE handshake event
      const initialHandshake = `data: ${JSON.stringify({
        type: 'connected',
        endpoint_id: endpointId,
        timestamp: new Date().toISOString(),
        message: 'Real-time edge event stream connected',
      })}\n\n`;

      controller.enqueue(new TextEncoder().encode(initialHandshake));

      // 3. Periodic keep-alive ping (every 15s) to prevent edge connection timeouts
      pingTimer = setInterval(() => {
        const ok = sendKeepAlive(controller);
        if (!ok) {
          if (pingTimer) clearInterval(pingTimer);
          unregisterStream(endpointId!, controller);
        }
      }, 15000);
    },

    cancel() {
      // Clean up controller and timer on client stream cancellation
      if (pingTimer) clearInterval(pingTimer);
      if (activeController) {
        unregisterStream(endpointId!, activeController);
      }
    },
  });

  // Handle client abort / disconnect signal
  request.signal?.addEventListener('abort', () => {
    if (pingTimer) clearInterval(pingTimer);
    if (activeController) {
      unregisterStream(endpointId!, activeController);
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    },
  });
};
