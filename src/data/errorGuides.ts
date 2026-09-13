export interface WebhookErrorGuide {
  slug: string;
  statusCode: number;
  title: string;
  headline: string;
  description: string;
  directAnswer: string;
  keyTakeaways: string[];
  rootCauses: Array<{ title: string; explanation: string }>;
  providerRetryBehaviors: Array<{ provider: string; schedule: string; maxDuration: string }>;
  troubleshootingChecklist: string[];
  fixCodeSnippet: string;
  howToSimulateInSafeWebhook: string[];
  faqs: Array<{ q: string; a: string }>;
}

export type ErrorGuideInfo = WebhookErrorGuide;

export const ERROR_GUIDES: Record<string, WebhookErrorGuide> = {
  'webhook-504-gateway-timeout': {
    slug: 'webhook-504-gateway-timeout',
    statusCode: 504,
    title: 'HTTP 504 Gateway Timeout Webhook Error',
    headline: 'How to Fix & Debug HTTP 504 Gateway Timeout Errors in Webhooks',
    description: 'Resolve HTTP 504 Gateway Timeout webhook failures from Stripe, Shopify, GitHub, and PayPal. Learn why reverse proxies terminate slow handlers and how to implement asynchronous queues.',
    directAnswer: 'An HTTP 504 Gateway Timeout error occurs when your edge reverse proxy (Cloudflare, Nginx, AWS ALB) terminates an inbound webhook request because your backend application failed to respond within the allowed timeout window (typically 2 to 5 seconds). The fix is to return a 200 OK immediately and offload payload processing to a background worker queue.',
    keyTakeaways: [
      'Cause: Handler took longer than the proxy timeout threshold (typically 2,000–5,000ms).',
      'Solution: Acknowledge with HTTP 200 OK immediately before database or external API work.',
      'Architecture: Push payloads to Redis, BullMQ, SQS, or RabbitMQ for async consumption.',
      'Test: Use SafeWebhook simulated latency slider to verify proxy timeout limits.'
    ],
    rootCauses: [
      {
        title: 'Synchronous Heavy Operations in Webhook Handlers',
        explanation: 'Performing database migrations, generating PDFs, sending transactional emails, or calling third-party APIs synchronously inside the webhook route exceeds the timeout limit.'
      },
      {
        title: 'Cold Starts on Serverless Platforms',
        explanation: 'AWS Lambda or Vercel Serverless Function cold starts can add 1,500ms to 4,000ms of latency, pushing total response time over the provider threshold.'
      },
      {
        title: 'Database Connection Pool Starvation',
        explanation: 'Under high webhook volume (e.g. flash sales or mass billing renewals), exhausted database connection pools cause threads to hang until proxies drop the connection.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Exponential backoff over 72 hours (up to 16 attempts)', maxDuration: '3 days' },
      { provider: 'Shopify', schedule: '19 attempts over 48 hours with 5-minute initial delay', maxDuration: '2 days' },
      { provider: 'GitHub', schedule: 'Immediate single retry or manual redelivery in UI', maxDuration: 'Manual' },
      { provider: 'Svix', schedule: 'Configurable retry schedule (up to 10 attempts over 24 hours)', maxDuration: '1 day' }
    ],
    troubleshootingChecklist: [
      'Verify that your webhook handler responds with `res.status(200).send("OK")` within < 500ms.',
      'Move all business logic, email triggers, and heavy computations to an asynchronous background worker (e.g. Redis/BullMQ, Inngest, Celery).',
      'Check server logs for database lock contentions or external API rate limits.',
      'Increase reverse proxy `proxy_read_timeout` in Nginx/HAProxy if serverless cold starts cannot be avoided.'
    ],
    fixCodeSnippet: `// Solution: Asynchronous Queue Pattern (Express + BullMQ / Redis)
import express from 'express';
import { Queue } from 'bullmq';

const app = express();
const webhookQueue = new Queue('webhook-events', { connection: { host: 'localhost', port: 6379 } });

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // 1. Verify cryptographic signature quickly (< 5ms)
  const isValid = verifySignature(req.body, req.headers['stripe-signature']);
  if (!isValid) return res.status(400).send('Invalid signature');

  // 2. Immediately enqueue payload for background worker
  await webhookQueue.add('process-event', {
    headers: req.headers,
    payload: JSON.parse(req.body.toString())
  });

  // 3. Respond with 200 OK within 20ms to prevent 504 Timeout
  res.status(200).json({ received: true });
});`,
    howToSimulateInSafeWebhook: [
      'Open the SafeWebhook Workbench at safewebhook.com/app.',
      'Go to "Response Config" tab and set Simulated Latency to 4500ms.',
      'Trigger an event from your webhook provider.',
      'Observe if your webhook provider marks the delivery as timed out (504).'
    ],
    faqs: [
      {
        q: 'Why did my webhook provider disable my endpoint after 504 errors?',
        a: 'Most providers automatically disable webhook endpoints after consecutive timeout failures over several hours to protect their retry pipelines.'
      },
      {
        q: 'Can I return 200 OK before verifying the cryptographic signature?',
        a: 'No. Always verify the signature first to prevent denial-of-service attacks from filling your background queue with forged requests.'
      }
    ]
  },
  'webhook-502-bad-gateway': {
    slug: 'webhook-502-bad-gateway',
    statusCode: 502,
    title: 'HTTP 502 Bad Gateway Webhook Error',
    headline: 'Fix HTTP 502 Bad Gateway Webhook Failures and Server Crashes',
    description: 'Troubleshoot HTTP 502 Bad Gateway errors in webhook endpoints. Fix backend crashes, unhandled promise rejections, and process restarts.',
    directAnswer: 'An HTTP 502 Bad Gateway webhook error indicates that your reverse proxy (Nginx, Caddy, AWS ALB, or Cloudflare) was unable to connect to your backend application server because the application crashed, restarted, or failed to bind to the expected port.',
    keyTakeaways: [
      'Cause: Node/Python backend crashed or was unreachable by the proxy.',
      'Common Trigger: Unhandled exceptions or syntax errors when parsing unexpected payloads.',
      'Fix: Wrap handler code in `try...catch` blocks and ensure process managers (PM2, Docker) restart cleanly.',
      'Test: Simulate 502 status in SafeWebhook to verify upstream error handling.'
    ],
    rootCauses: [
      {
        title: 'Unhandled Exception Crashes the Server Process',
        explanation: 'Accessing properties on undefined payload objects (e.g. `req.body.data.object.user.id`) without optional chaining crashes the Node.js/Python process, closing the socket prematurely.'
      },
      {
        title: 'Process Manager Restarts Under Memory Spike',
        explanation: 'High memory usage from large JSON payloads causes PM2 or Kubernetes OOM (Out of Memory) kills while the proxy is waiting for a response.'
      },
      {
        title: 'Port or Socket Misconfiguration',
        explanation: 'The reverse proxy is forwarding traffic to port 3000 while the application failed to start or bound exclusively to 127.0.0.1 instead of 0.0.0.0.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Exponential backoff over 72 hours', maxDuration: '3 days' },
      { provider: 'Shopify', schedule: '19 retries over 48 hours', maxDuration: '2 days' },
      { provider: 'GitHub', schedule: 'Manual retry in repo settings', maxDuration: 'Manual' }
    ],
    troubleshootingChecklist: [
      'Check server error logs (`pm2 logs`, `journalctl -u app`, Docker logs) for uncaught exceptions.',
      'Use optional chaining (`event?.data?.object?.id`) when traversing deeply nested webhook payloads.',
      'Wrap all JSON parsing and handler logic in comprehensive `try...catch` blocks.',
      'Ensure process managers have auto-restart and memory headroom configured.'
    ],
    fixCodeSnippet: `// Solution: Safe Payload Access with Defensive try/catch
app.post('/webhook', express.json(), (req, res) => {
  try {
    const event = req.body;
    
    // Use optional chaining to prevent process crashes
    const customerId = event?.data?.object?.customer ?? null;
    const amount = event?.data?.object?.amount ?? 0;
    
    console.log(\`Received event \${event?.type} for customer \${customerId}\`);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed gracefully:', error);
    // Return 400 Bad Request instead of letting server crash with 502
    return res.status(400).json({ error: 'Payload processing error' });
  }
});`,
    howToSimulateInSafeWebhook: [
      'In SafeWebhook Response Config, select HTTP Status Code 502 Bad Gateway.',
      'Save configuration and send a test webhook.',
      'Inspect how your sender logs and retries the 502 error.'
    ],
    faqs: [
      {
        q: 'What is the difference between a 502 Bad Gateway and 504 Gateway Timeout?',
        a: 'A 502 means the backend server crashed or actively refused the connection. A 504 means the backend server connected but took too long to reply.'
      }
    ]
  },
  'webhook-500-internal-server-error': {
    slug: 'webhook-500-internal-server-error',
    statusCode: 500,
    title: 'HTTP 500 Internal Server Error Webhook Fix',
    headline: 'How to Fix HTTP 500 Internal Server Error in Webhook Receivers',
    description: 'Diagnose and fix HTTP 500 Internal Server Error responses during webhook processing. Resolve database transaction errors, missing environment variables, and unhandled errors.',
    directAnswer: 'An HTTP 500 Internal Server Error indicates an unhandled runtime error inside your application code (such as a database query failure, missing environment secret, or null pointer exception) while processing the webhook payload.',
    keyTakeaways: [
      'Cause: Runtime exception thrown inside your backend controller.',
      'Impact: Upstream providers will retry with exponential backoff.',
      'Fix: Implement robust error logging with correlation IDs and graceful error responses.',
      'Simulate: Test 500 error response simulation in SafeWebhook without writing code.'
    ],
    rootCauses: [
      {
        title: 'Database Foreign Key Constraint Violations',
        explanation: 'Inserting a webhook event (e.g. invoice.paid) before the related customer record exists in the local database throws an unhandled SQL exception.'
      },
      {
        title: 'Missing or Expired API Secrets',
        explanation: 'Attempting to call third-party services with invalid environment variables (e.g. undefined `process.env.STRIPE_WEBHOOK_SECRET`) throws runtime errors.'
      },
      {
        title: 'Idempotency Key Collisions',
        explanation: 'Retried webhooks attempting to insert duplicate primary keys without `ON CONFLICT DO NOTHING` clauses result in unhandled database errors.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Retries up to 16 times over 3 days', maxDuration: '72 hours' },
      { provider: 'Shopify', schedule: 'Retries up to 19 times over 48 hours', maxDuration: '48 hours' }
    ],
    troubleshootingChecklist: [
      'Inspect application exception stack traces for SQL or runtime errors.',
      'Implement database idempotency using unique event IDs (`event_id` unique constraint).',
      'Verify all required environment variables are loaded on server startup.',
      'Return HTTP 200 once signature is validated and handle internal processing in background jobs.'
    ],
    fixCodeSnippet: `// Solution: Idempotent Database Insert Pattern
import { db } from './db';

export async function handleWebhookEvent(event) {
  // Idempotent record insertion to prevent 500 duplicate key errors
  const inserted = await db.query(
    \`INSERT INTO processed_events (event_id, event_type, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id\`,
    [event.id, event.type]
  );

  if (inserted.rowCount === 0) {
    console.log(\`Event \${event.id} already processed. Skipping.\`);
    return { status: 'already_processed' };
  }

  // Execute business logic safely
  await processEventData(event);
  return { status: 'success' };
}`,
    howToSimulateInSafeWebhook: [
      'Open SafeWebhook Response Config and select HTTP 500.',
      'Set a custom error message like `{"error": "db_connection_failed"}`.',
      'Send a test event to verify how your producer handles 500 responses.'
    ],
    faqs: [
      {
        q: 'Should I return 500 if a webhook payload is invalid?',
        a: 'No. If the payload format or signature is invalid, return HTTP 400 or 401. Only return 500 if a temporary server outage occurred and you WANT the provider to retry.'
      }
    ]
  },
  'webhook-429-rate-limit-exceeded': {
    slug: 'webhook-429-rate-limit-exceeded',
    statusCode: 429,
    title: 'HTTP 429 Too Many Requests Webhook Error',
    headline: 'Fix HTTP 429 Rate Limit Errors and Webhook Throttling',
    description: 'Learn how to handle and resolve HTTP 429 Too Many Requests errors in high-volume webhook systems. Configure Retry-After headers and smooth traffic spikes.',
    directAnswer: 'An HTTP 429 Too Many Requests error occurs when your webhook receiver or API gateway rate limiter throttles incoming events due to sudden traffic bursts. To prevent dropped events, configure Retry-After headers and buffer events with an edge queue.',
    keyTakeaways: [
      'Cause: Burst of webhook events exceeded your API gateway rate limit threshold.',
      'Risk: If retries are exhausted, critical financial or user sync events may be dropped.',
      'Fix: Add webhook endpoint to rate limiter whitelist or use an edge buffer.',
      'Simulate: Test Retry-After header handling in SafeWebhook.'
    ],
    rootCauses: [
      {
        title: 'Global API Rate Limiter Applied to Webhook Endpoints',
        explanation: 'Applying the same IP-based rate limiter (e.g. 60 req/min) to webhook routes throttles legitimate batch dispatches from providers like Stripe or Shopify.'
      },
      {
        title: 'Batch Sync Events or Mass Updates',
        explanation: 'Creating 10,000 subscriptions or bulk editing products causes providers to dispatch thousands of concurrent webhooks within seconds.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Honors Retry-After headers with exponential backoff', maxDuration: '72 hours' },
      { provider: 'Shopify', schedule: 'Backs off and retries over 48 hours', maxDuration: '48 hours' }
    ],
    troubleshootingChecklist: [
      'Exclude `/api/webhook/*` routes from standard user rate limiters.',
      'Return a valid `Retry-After: 60` header when 429 is unavoidable.',
      'Buffer high-throughput webhooks using Cloudflare Queues or AWS SQS.',
      'Monitor provider webhook delivery failure metrics in your dashboard.'
    ],
    fixCodeSnippet: `// Solution: Exclude Webhooks from Rate Limiter & Return Retry-After
import rateLimit from 'express-rate-limit';

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path.startsWith('/api/webhook') // Whitelist webhooks
});

app.use(generalLimiter);

// Webhook-specific backpressure handler
app.post('/api/webhook', (req, res) => {
  if (isSystemOverloaded()) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'System overloaded, retry in 60s' });
  }
  res.status(200).json({ ok: true });
});`,
    howToSimulateInSafeWebhook: [
      'In SafeWebhook Response Config, select HTTP 429.',
      'Add custom header `Retry-After: 30`.',
      'Trigger webhooks to verify upstream backoff cadence.'
    ],
    faqs: [
      {
        q: 'Do webhook senders respect Retry-After headers?',
        a: 'Yes. Modern providers like Stripe, Resend, and Clerk read the `Retry-After` header and delay subsequent retry attempts accordingly.'
      }
    ]
  },
  'webhook-400-bad-request': {
    slug: 'webhook-400-bad-request',
    statusCode: 400,
    title: 'HTTP 400 Bad Request Webhook Error Fix',
    headline: 'Troubleshoot HTTP 400 Bad Request and Invalid JSON Webhook Failures',
    description: 'Fix HTTP 400 Bad Request errors in webhook receivers. Resolve JSON parsing issues, body-parser mutations, and payload schema mismatches.',
    directAnswer: 'An HTTP 400 Bad Request error occurs when the webhook receiver rejects the incoming payload due to malformed JSON, mismatched Content-Type headers, missing required fields, or raw body mutation during signature validation.',
    keyTakeaways: [
      'Cause: Malformed body, missing required fields, or raw body parsing conflict.',
      'Most common trigger: Express `bodyParser.json()` altering raw bytes before signature check.',
      'Fix: Capture raw buffer before middleware parsing.',
      'Simulate: Inspect raw body byte streams in SafeWebhook.'
    ],
    rootCauses: [
      {
        title: 'Middleware JSON Mutation Before Signature Verification',
        explanation: 'Parsing JSON transforms raw byte strings (normalizing whitespace and unicode escapes), causing cryptographic signature hashes to fail.'
      },
      {
        title: 'Content-Type Mismatch',
        explanation: 'The sender dispatches `application/x-www-form-urlencoded` (e.g. Twilio or PayPal IPN) while the server expects `application/json`.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Treats 400 as a terminal error or retries on transient errors', maxDuration: '72 hours' },
      { provider: 'GitHub', schedule: 'Logs delivery as failed in webhook history', maxDuration: 'None' }
    ],
    troubleshootingChecklist: [
      'Ensure raw body buffer is preserved for signature verification.',
      'Check if sender sends URL-encoded form data vs JSON.',
      'Validate that JSON payload is not truncated by proxy size limits.',
      'Inspect incoming headers and raw body in SafeWebhook.'
    ],
    fixCodeSnippet: `// Solution: Preserving Raw Body in Express for Webhook Verification
import express from 'express';

const app = express();

// Use express.raw ONLY for webhook routes
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_SECRET);
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(\`Webhook Error: \${err.message}\`);
  }
});

// Standard JSON parser for all other routes
app.use(express.json());`,
    howToSimulateInSafeWebhook: [
      'In SafeWebhook Response Config, select status code 400.',
      'Provide custom error schema `{"error": "invalid_payload_format"}`.',
      'Trigger webhooks to inspect provider error handling.'
    ],
    faqs: [
      {
        q: 'Why does my signature verification fail with a 400 error only in production?',
        a: 'Compression middleware (like gzip/deflate) or reverse proxies (Cloudflare, AWS ALB) might be modifying request bodies in production.'
      }
    ]
  },
  'webhook-401-unauthorized-signature-failed': {
    slug: 'webhook-401-unauthorized-signature-failed',
    statusCode: 401,
    title: 'HTTP 401 Unauthorized / Signature Failed Webhook Fix',
    headline: 'Fix HTTP 401 Unauthorized and Webhook Signature Mismatches',
    description: 'Resolve webhook signature verification failures (Stripe, GitHub, Shopify, Clerk). Fix incorrect signing secrets, clock skew, and encoding errors.',
    directAnswer: 'An HTTP 401 Unauthorized error occurs when the webhook receiver fails to cryptographically verify the sender’s signature header (e.g. Stripe-Signature or X-Hub-Signature-256), indicating an incorrect secret key, modified payload, or clock drift.',
    keyTakeaways: [
      'Cause: Cryptographic HMAC digest computed by receiver does not match signature header.',
      'Common reason: Using API Secret Key instead of Webhook Signing Secret (`whsec_...`).',
      'Security: Never disable signature verification in production.',
      'Tools: Use SafeWebhook Signature Verifier to inspect headers and compute hashes.'
    ],
    rootCauses: [
      {
        title: 'Using API Secret Key Instead of Webhook Signing Secret',
        explanation: 'Stripe, Shopify, and Clerk use dedicated webhook signing secrets (e.g. `whsec_...`) distinct from standard API keys (`sk_live_...`).'
      },
      {
        title: 'Server Clock Drift (Timestamp Mismatch)',
        explanation: 'If your server clock differs by more than 5 minutes from NTP time, timestamp-based signature verifiers (Stripe, Svix) will reject the payload.'
      },
      {
        title: 'String vs Buffer Encoding Discrepancies',
        explanation: 'Computing HMACs on UTF-8 converted strings instead of raw binary buffers alters byte representations of unicode characters.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Retries with exponential backoff', maxDuration: '72 hours' },
      { provider: 'Clerk / Svix', schedule: 'Retries over 24 hours', maxDuration: '24 hours' }
    ],
    troubleshootingChecklist: [
      'Confirm you copied the Webhook Signing Secret (`whsec_...`) and not your API key.',
      'Sync server clock with NTP (`sudo ntpdate pool.ntp.org`).',
      'Pass raw unmodified body buffer to the verification library.',
      'Use `crypto.timingSafeEqual` to avoid timing side-channel attacks.'
    ],
    fixCodeSnippet: `// Solution: Correct Stripe Signature Verification
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET! // Must be whsec_...
    );
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error(\`Signature verification failed: \${err.message}\`);
    return new Response(\`Unauthorized: \${err.message}\`, { status: 401 });
  }
}`,
    howToSimulateInSafeWebhook: [
      'In SafeWebhook, inspect the incoming signature header on the "Verify Signature" tab.',
      'Compare your local secret key with the generated recipe.',
      'Test your handler locally using SafeWebhook Replay Drawer.'
    ],
    faqs: [
      {
        q: 'Where do I find the webhook secret in Stripe?',
        a: 'Go to Stripe Dashboard > Developers > Webhooks > Click your endpoint > Click "Reveal" under "Signing secret".'
      }
    ]
  },
  'webhook-403-forbidden': {
    slug: 'webhook-403-forbidden',
    statusCode: 403,
    title: 'HTTP 403 Forbidden Webhook Error',
    headline: 'How to Fix HTTP 403 Forbidden Webhook Errors and IP Blocks',
    description: 'Resolve HTTP 403 Forbidden errors on webhook endpoints caused by WAF rules, Cloudflare Bot Protection, IP whitelists, and CSRF protection.',
    directAnswer: 'An HTTP 403 Forbidden error indicates that a Web Application Firewall (Cloudflare WAF, AWS WAF) or framework security middleware (CSRF protection, IP restriction) intercepted and blocked the incoming webhook request before it reached your handler.',
    keyTakeaways: [
      'Cause: Cloudflare WAF, Bot Fight Mode, or CSRF token checks blocking sender IP.',
      'Fix: Disable CSRF validation on `/api/webhook/*` routes.',
      'Fix: Create a WAF skip rule for webhook endpoints in Cloudflare/AWS.',
      'Verify: Test WAF bypass rules using SafeWebhook.'
    ],
    rootCauses: [
      {
        title: 'Cloudflare Bot Fight Mode / WAF Challenge',
        explanation: 'Cloudflare Challenge or Managed Challenge triggers when automated webhook user-agents arrive without browser JS capabilities.'
      },
      {
        title: 'Framework CSRF Protection Active on POST Routes',
        explanation: 'Django, Rails, and Laravel reject external POST requests without valid CSRF tokens by default with a 403 Forbidden.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Retries over 72 hours', maxDuration: '72 hours' },
      { provider: 'Shopify', schedule: 'Retries over 48 hours', maxDuration: '48 hours' }
    ],
    troubleshootingChecklist: [
      'Add WAF exception rule in Cloudflare: `(http.request.uri.path contains "/api/webhook") => Skip Security Rules`.',
      'Exempt webhook routes from CSRF middleware in Django (`@csrf_exempt`) or Laravel (`$except` array).',
      'Allow provider IP ranges if strict firewall rules are active.',
      'Check server response headers to identify which layer emitted the 403.'
    ],
    fixCodeSnippet: `// Django CSRF Exemption Example:
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse

@csrf_exempt
def stripe_webhook(request):
    if request.method == 'POST':
        # Process webhook safely
        return HttpResponse(status=200)
    return HttpResponse(status=405)`,
    howToSimulateInSafeWebhook: [
      'In SafeWebhook Response Config, select status 403 Forbidden.',
      'Trigger webhooks to verify provider notification logging.'
    ],
    faqs: [
      {
        q: 'Why did Cloudflare block my Stripe webhooks with 403 Forbidden?',
        a: 'Cloudflare Bot Management can misclassify webhook bots. Create a WAF Custom Rule to Bypass WAF when `http.request.uri.path contains "/api/webhook"`.'
      }
    ]
  },
  'webhook-408-request-timeout': {
    slug: 'webhook-408-request-timeout',
    statusCode: 408,
    title: 'HTTP 408 Request Timeout Webhook Error',
    headline: 'Fix HTTP 408 Request Timeout Errors in Webhook Streaming',
    description: 'Diagnose and resolve HTTP 408 Request Timeout errors during webhook delivery. Fix slow TLS handshakes, MTU packet drops, and network delays.',
    directAnswer: 'An HTTP 408 Request Timeout error indicates that the connection between the webhook producer and your server timed out while establishing the socket, completing the TLS handshake, or sending the HTTP request body.',
    keyTakeaways: [
      'Cause: Network latency, slow SSL/TLS handshake, or connection drops.',
      'Difference: 408 occurs at transport layer before full request transmission.',
      'Fix: Ensure HTTP keep-alive is enabled and TLS certificates are valid.',
      'Test: Use SafeWebhook global edge network to inspect edge latency.'
    ],
    rootCauses: [
      {
        title: 'Slow TLS Certificate Handshake',
        explanation: 'Misconfigured OCSP stapling or slow SSL negotiation causes the webhook sender connection timer to expire.'
      },
      {
        title: 'Geographic Latency and Congestion',
        explanation: 'Receivers hosted in distant regions without edge caching experience high packet round-trip times.'
      }
    ],
    providerRetryBehaviors: [
      { provider: 'Stripe', schedule: 'Retries with exponential backoff', maxDuration: '72 hours' },
      { provider: 'PayPal', schedule: 'Retries periodically over 24 hours', maxDuration: '24 hours' }
    ],
    troubleshootingChecklist: [
      'Ensure server supports HTTP/2 and keep-alive connections.',
      'Verify SSL certificate validity and OCSP stapling configuration.',
      'Use an edge reverse proxy (Cloudflare, Fastly) to terminate TLS close to sender.',
      'Inspect network round-trip time in SafeWebhook edge metrics.'
    ],
    fixCodeSnippet: `// Enable HTTP Keep-Alive in Node.js Server
import http from 'http';

const server = http.createServer(app);
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds
server.listen(3000);`,
    howToSimulateInSafeWebhook: [
      'Open SafeWebhook and check real-time latency indicators for your endpoint.',
      'Simulate response delays to verify edge timeout thresholds.'
    ],
    faqs: [
      {
        q: 'How does edge proxying prevent HTTP 408 errors?',
        a: 'Edge proxies terminate TLS connections at the nearest global point of presence (PoP), reducing connection establishment time from hundreds of milliseconds to under 20ms.'
      }
    ]
  }
};

export const ERROR_GUIDE_SLUGS = Object.keys(ERROR_GUIDES);
