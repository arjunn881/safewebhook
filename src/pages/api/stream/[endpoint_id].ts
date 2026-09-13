import type { APIRoute } from 'astro';
import { registerStream, unregisterStream, sendKeepAlive, activeStreams } from '../../../lib/streams';
import { isValidEndpointId, CORS_HEADERS, errorResponse } from '../../../lib/http';
import { getWebhookPayloads } from '../../../lib/kv_store';

export const prerender = false;

/** Maximum concurrent SSE listeners per endpoint to prevent resource exhaustion */
const MAX_LISTENERS_PER_ENDPOINT = 50;

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
 * GET /api/stream/:endpoint_id — Real-Time Server-Sent Events (SSE) Stream
 * Establishes a persistent SSE connection for a given endpoint.
 * Heartbeat every 25s to stay within Cloudflare's 30s idle timeout.
 */
export const GET: APIRoute = async (context) => {
  const { params, request } = context;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  // Enforce max concurrent listeners per endpoint
  const existing = activeStreams.get(endpointId!);
  if (existing && existing.size >= MAX_LISTENERS_PER_ENDPOINT) {
    return errorResponse(
      `Endpoint has reached the maximum of ${MAX_LISTENERS_PER_ENDPOINT} concurrent listeners.`,
      429
    );
  }

  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let syncTimer: ReturnType<typeof setInterval> | null = null;
  let activeController: ReadableStreamDefaultController | null = null;
  let isCleanedUp = false;

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }

    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    if (activeController) {
      unregisterStream(endpointId!, activeController);
      try {
        activeController.close();
      } catch {
        // Stream may already be closed, cancelled, or aborted
      }
      activeController = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      activeController = controller;

      // 1. Register controller in global in-memory activeStreams map
      registerStream(endpointId!, controller);

      const encoder = new TextEncoder();
      const seenIds = new Set<string>();

      // 2. Send initial SSE handshake event with retry hint (3s auto-reconnect)
      const initialHandshake = [
        `retry: 3000`,
        `data: ${JSON.stringify({
          type: 'connected',
          endpoint_id: endpointId,
          timestamp: new Date().toISOString(),
          message: 'Real-time edge event stream connected.',
        })}`,
        '',
        '',
      ].join('\n');

      try {
        controller.enqueue(encoder.encode(initialHandshake));
      } catch {
        cleanup();
        return;
      }

      // Pre-seed seenIds with existing KV payloads to only stream newly arriving webhooks
      getWebhookPayloads(endpointId!).then((initial) => {
        if (Array.isArray(initial)) {
          for (const item of initial) {
            if (item?.id) seenIds.add(item.id);
          }
        }
      }).catch(() => {});

      // 3. Cross-isolate sync: checks KV every 2.5s for webhooks ingested on other edge isolates
      syncTimer = setInterval(async () => {
        try {
          if (isCleanedUp || !activeController) return;
          const payloads = await getWebhookPayloads(endpointId!);
          if (!Array.isArray(payloads) || payloads.length === 0) return;

          // Iterate newest to oldest or reverse to maintain chronological order
          for (let i = payloads.length - 1; i >= 0; i--) {
            const p = payloads[i];
            if (p?.id && !seenIds.has(p.id)) {
              seenIds.add(p.id);
              if (activeController) {
                try {
                  activeController.enqueue(encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
                } catch {
                  cleanup();
                  return;
                }
              }
            }
          }
        } catch {
          // Ignore background sync errors
        }
      }, 2500);

      // 4. Periodic keep-alive ping every 25s (stays under Cloudflare's 30s idle timeout)
      pingTimer = setInterval(() => {
        try {
          const ok = sendKeepAlive(controller);
          if (!ok) {
            cleanup();
          }
        } catch {
          cleanup();
        }
      }, 25_000);
    },

    cancel() {
      // Clean up controller and timer on client stream cancellation
      cleanup();
    },
  });

  // Handle client abort / disconnect signal
  request.signal?.addEventListener('abort', cleanup, { once: true });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-SSE-Endpoint': endpointId!,
      ...CORS_HEADERS,
    },
  });
};
