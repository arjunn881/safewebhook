import type { APIRoute } from 'astro';
import { jsonResponse, CORS_HEADERS } from '../../lib/http';

export const prerender = false;

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
};

export const GET: APIRoute = async () => {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'SafeWebhook Edge REST API',
      version: '1.0.0',
      description:
        'Production-grade REST API for SafeWebhook (safewebhook.com). Inspect, stream, replay, configure, and export incoming webhooks and email payloads with zero server retention.',
      contact: {
        name: 'SafeWebhook Developer Support',
        url: 'https://safewebhook.com/docs',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://safewebhook.com',
        description: 'Production Global Edge (Cloudflare Anycast)',
      },
      {
        url: 'https://www.safewebhook.com',
        description: 'Production Global Edge (WWW Alternate)',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
    ],
    paths: {
      '/api/r/{endpoint_id}': {
        post: {
          summary: 'Universal Inbound Webhook Receiver',
          description:
            'Ingests incoming webhook payloads from Stripe, GitHub, Shopify, Slack, Twilio, or custom systems. Streams payloads in real-time to active SSE listeners and saves to local session buffer.',
          operationId: 'receiveWebhook',
          parameters: [
            {
              name: 'endpoint_id',
              in: 'path',
              required: true,
              description: 'Unique endpoint identifier (1-64 characters).',
              schema: { type: 'string', example: 'ep_dev_9a7d3b' },
            },
          ],
          requestBody: {
            description: 'Webhook payload body (JSON, XML, Form-Data, or Plain Text. Max 1MB).',
            required: false,
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: { event: 'payment_intent.succeeded', amount: 4900, currency: 'usd' },
              },
              '*/*': {
                schema: { type: 'string' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Webhook successfully processed and broadcast.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Webhook received' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid endpoint ID.' },
            '413': { description: 'Payload too large (> 1MB).' },
            '429': { description: 'Rate limit exceeded (> 100 requests/min).' },
          },
        },
      },
      '/api/stream/{endpoint_id}': {
        get: {
          summary: 'Real-Time Server-Sent Events (SSE) Stream',
          description:
            'Opens a persistent SSE connection. Pushes incoming webhooks and emails in sub-20ms with automatic heartbeat keep-alive.',
          operationId: 'streamEvents',
          parameters: [
            {
              name: 'endpoint_id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'ep_dev_9a7d3b' },
            },
          ],
          responses: {
            '200': {
              description: 'Real-time text/event-stream stream.',
              content: {
                'text/event-stream': {
                  schema: { type: 'string' },
                },
              },
            },
            '429': { description: 'Max listener limit reached (50 concurrent listeners).' },
          },
        },
      },
      '/api/history/{endpoint_id}': {
        get: {
          summary: 'Retrieve Paginated Webhook History',
          description:
            'Fetches captured webhooks for an endpoint with optional filtering by HTTP method, timestamp range, and full substring search.',
          operationId: 'getHistory',
          parameters: [
            {
              name: 'endpoint_id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'ep_dev_9a7d3b' },
            },
            {
              name: 'page',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 50, maximum: 100 },
            },
            {
              name: 'method',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'POST' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'payment_intent' },
            },
          ],
          responses: {
            '200': {
              description: 'History collection.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      endpoint_id: { type: 'string', example: 'ep_dev_9a7d3b' },
                      count: { type: 'integer', example: 1 },
                      total: { type: 'integer', example: 1 },
                      page: { type: 'integer', example: 1 },
                      limit: { type: 'integer', example: 50 },
                      webhooks: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/stats/{endpoint_id}': {
        get: {
          summary: 'Real-Time Endpoint Analytics & Breakdown',
          description:
            'Returns hourly event counts, method distribution, average payload size, and detected cryptographic signature providers.',
          operationId: 'getStats',
          parameters: [
            {
              name: 'endpoint_id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'ep_dev_9a7d3b' },
            },
          ],
          responses: {
            '200': {
              description: 'Statistical summary.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      endpoint_id: { type: 'string' },
                      total_events: { type: 'integer' },
                      avg_payload_bytes: { type: 'number' },
                      methods: { type: 'object' },
                      signatures: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/export/{endpoint_id}': {
        get: {
          summary: 'Bulk Data Export (JSON / NDJSON)',
          description:
            'Exports all captured webhook records as a downloadable JSON array or streaming NDJSON file.',
          operationId: 'exportPayloads',
          parameters: [
            {
              name: 'endpoint_id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'ep_dev_9a7d3b' },
            },
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['json', 'ndjson'], default: 'json' },
            },
          ],
          responses: {
            '200': {
              description: 'Exported file attachment.',
            },
          },
        },
      },
      '/api/replay': {
        post: {
          summary: 'SSRF-Protected Request Replay Engine',
          description:
            'Replays an intercepted webhook payload to any target destination with exponential-backoff retries (0-3 attempts) and SSRF loopback blocking.',
          operationId: 'replayWebhook',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['target_url'],
                  properties: {
                    target_url: { type: 'string', example: 'https://api.example.com/webhook' },
                    method: { type: 'string', default: 'POST', example: 'POST' },
                    headers: { type: 'object', example: { 'Content-Type': 'application/json' } },
                    body: { type: 'string', example: '{"test":true}' },
                    retry_count: { type: 'integer', minimum: 0, maximum: 3, default: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Replay execution results including roundtrip latency and status code.',
            },
            '400': { description: 'Blocked by SSRF protection or missing target URL.' },
            '429': { description: 'Rate limit exceeded (20 replays/min per client IP).' },
          },
        },
      },
      '/api/config/{endpoint_id}': {
        get: {
          summary: 'Get Custom Response Configuration',
          operationId: 'getConfig',
          parameters: [
            { name: 'endpoint_id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Active configuration.' },
          },
        },
        post: {
          summary: 'Set Custom Status Code, Headers, Body, and Delay',
          operationId: 'setConfig',
          parameters: [
            { name: 'endpoint_id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    statusCode: { type: 'integer', default: 200, example: 201 },
                    contentType: { type: 'string', default: 'application/json' },
                    responseBody: { type: 'string', example: '{"status":"created"}' },
                    delayMs: { type: 'integer', minimum: 0, maximum: 5000, default: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Configuration updated.' },
          },
        },
      },
      '/api/health': {
        get: {
          summary: 'Production Edge Health Check',
          description:
            'Returns Cloudflare Worker runtime status, D1 database connectivity, and KV store health.',
          operationId: 'healthCheck',
          responses: {
            '200': { description: 'All edge services healthy.' },
            '503': { description: 'Service degraded.' },
          },
        },
      },
    },
  };

  return jsonResponse(spec, 200, {
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  });
};
