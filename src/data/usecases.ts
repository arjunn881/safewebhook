export interface ToolUseCase {
  slug: string;
  name: string;
  headline: string;
  description: string;
  directAnswer?: string;
  keyTakeaways?: string[];
  targetQueries: string[];
  benefits: string[];
  practicalGuide: string[];
  codeSnippet: string;
  faqs: Array<{ q: string; a: string }>;
}

export type UseCaseInfo = ToolUseCase;

export const USE_CASES: Record<string, ToolUseCase> = {
  'mock-api-response': {
    slug: 'mock-api-response',
    name: 'Custom Webhook Status Code & Response Simulator',
    headline: 'Simulate HTTP 200, 201, 400, 429, and 500 error responses for any webhook call',
    description: 'Easily test how your third-party providers (Stripe, GitHub, Shopify) react when your backend endpoint returns errors, custom JSON schemas, or empty 204 responses on safewebhook.com.',
    directAnswer: 'SafeWebhook allows you to return any custom HTTP status code (200, 201, 400, 429, 500), custom headers, and mock JSON/XML response bodies. Use this to verify that upstream webhook senders trigger appropriate retry logic.',
    keyTakeaways: [
      'Configure status codes (200, 201, 204, 400, 404, 500, 502, 503) via simple GUI.',
      'Return custom JSON, XML, or Plaintext response bodies.',
      'Inject response headers (e.g. Retry-After, X-RateLimit).',
      'Zero registration, 100% free at safewebhook.com.'
    ],
    targetQueries: [
      'mock api endpoint free',
      'simulate http 500 error webhook',
      'custom webhook response status code',
      'test webhook 400 error handling',
      'free mock webhook server'
    ],
    benefits: [
      'Configure status codes (200, 201, 204, 400, 404, 500, 502, 503) without writing code',
      'Custom response bodies in JSON, XML, Plaintext, or HTML',
      'Inject customized response headers (e.g. Retry-After, X-RateLimit)',
      '100% free with zero registration required'
    ],
    practicalGuide: [
      'Navigate to the SafeWebhook workbench at safewebhook.com/app.',
      'Click on the "Response Config" tab in the top bar.',
      'Select your desired HTTP Status Code (e.g. 500 Internal Server Error).',
      'Provide a custom JSON response body, then click Save Configuration.',
      'Trigger an event from your provider to verify their retry handling.'
    ],
    codeSnippet: `// Programmatically configure endpoint response via SafeWebhook Edge API
await fetch('https://safewebhook.com/api/config/YOUR_ENDPOINT_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statusCode: 500,
    contentType: 'application/json',
    responseBody: JSON.stringify({ error: "Temporary internal server glitch", retry: true }),
    delayMs: 0
  })
});`,
    faqs: [
      {
        q: 'Why should I simulate HTTP 500 errors during webhook development?',
        a: 'Most providers like Stripe and Shopify implement exponential backoff retry algorithms. Testing 500 errors guarantees your sender retries gracefully without dropping transactions.'
      },
      {
        q: 'Can I return XML bodies for legacy webhook providers?',
        a: 'Yes, change the Content-Type dropdown to application/xml and supply your custom XML schema.'
      }
    ]
  },
  'simulate-latency': {
    slug: 'simulate-latency',
    name: 'Webhook Latency & Timeout Simulator',
    headline: 'Simulate high latency and network delays (0–5000ms) to test webhook timeouts',
    description: 'Ensure your webhook producer handles slow endpoints, timeouts, and network congestion gracefully on safewebhook.com.',
    directAnswer: 'With SafeWebhook’s Latency Simulator, you can delay endpoint responses by 0 to 5000ms. This enables testing upstream timeout thresholds (such as Stripe’s 5-second timeout) before deploying to production.',
    keyTakeaways: [
      'Custom delay slider from 0ms to 5,000ms.',
      'Test edge gateway connection timeouts before production.',
      'Verify asynchronous queue processing under high load.',
      'Works across all HTTP methods (GET, POST, PUT, DELETE, PATCH).'
    ],
    targetQueries: [
      'simulate webhook timeout',
      'inject network latency webhook',
      'test webhook delay online',
      'mock slow webhook response',
      'webhook timeout testing tool'
    ],
    benefits: [
      'Custom delay slider from 0ms to 5,000ms',
      'Test edge gateway connection timeouts before production',
      'Verify asynchronous queue processing under high load',
      'Works with all HTTP methods (GET, POST, PUT, DELETE, PATCH)'
    ],
    practicalGuide: [
      'Open the Response Config settings in SafeWebhook at safewebhook.com.',
      'Drag the Simulated Latency slider to your target delay (e.g. 3500ms).',
      'Click "Save Configuration".',
      'SafeWebhook will hold the connection open for exactly 3500ms before returning the response.'
    ],
    codeSnippet: `// Set 3500ms response delay via API
await fetch('https://safewebhook.com/api/config/YOUR_ENDPOINT_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statusCode: 200,
    contentType: 'application/json',
    responseBody: JSON.stringify({ status: "processed_after_delay" }),
    delayMs: 3500
  })
});`,
    faqs: [
      {
        q: 'What is the default timeout limit for webhook providers?',
        a: 'Most providers (e.g., Stripe, Slack, Shopify) will terminate connections if an endpoint does not acknowledge with a 200 OK within 2 to 5 seconds.'
      }
    ]
  },
  'verify-signatures': {
    slug: 'verify-signatures',
    name: 'Cryptographic HMAC Signature Verifier',
    headline: 'Validate HMAC-SHA256, Ed25519, and Svix signatures with live cryptographic recipes',
    description: 'Protect your backend from spoofed webhooks. SafeWebhook extracts signature headers and gives you copy-paste verification code for Node.js, Python, Go, and PHP.',
    directAnswer: 'SafeWebhook automatically detects webhook signature headers (Stripe-Signature, X-Hub-Signature-256, X-Shopify-Hmac-Sha256, Svix) and generates timing-safe verification code in Node.js, Python, Go, and PHP.',
    keyTakeaways: [
      'Auto-detects signature headers from 20+ major platforms.',
      'Extracts timestamp, nonce, and hash algorithms.',
      'Generates timing-safe cryptographic verification recipes.',
      'Prevents timing attacks using crypto.timingSafeEqual.'
    ],
    targetQueries: [
      'verify stripe signature nodejs python',
      'verify x-hub-signature-256',
      'verify x-shopify-hmac-sha256',
      'webhook signature validator online',
      'test hmac signature webhook'
    ],
    benefits: [
      'Auto-detects signature headers from 20+ major platforms',
      'Extracts timestamp, nonce, and hash algorithms',
      'Generates timing-safe cryptographic verification recipes',
      'Prevents timing attacks using crypto.timingSafeEqual'
    ],
    practicalGuide: [
      'Receive a test webhook on your SafeWebhook endpoint.',
      'Click on the incoming request in the timeline.',
      'Click the "Verify Signature" tab to see auto-detected signature parameters.',
      'Copy the generated code into your backend handler.'
    ],
    codeSnippet: `// Node.js Timing-Safe HMAC-SHA256 Verification
import crypto from 'crypto';

export function verifyWebhookSignature(rawBody, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}`,
    faqs: [
      {
        q: 'Why should I always use timingSafeEqual for signature verification?',
        a: 'Standard string comparisons (`===`) terminate at the first mismatched character, allowing attackers to deduce signatures via microsecond timing differences.'
      }
    ]
  },
  'replay-to-localhost': {
    slug: 'replay-to-localhost',
    name: '1-Click Localhost Replay Proxy (Ngrok Alternative)',
    headline: 'Replay captured webhook payloads directly to your local development server with zero tunnels',
    description: 'Forward captured Stripe, Shopify, and GitHub events directly to http://localhost:3000/webhook with identical raw bodies and headers using SafeWebhook.',
    directAnswer: 'SafeWebhook allows you to forward any captured webhook event directly to your local server (http://localhost:3000 or http://localhost:8000) using the built-in Replay Drawer or a single-line SSE forwarder script without installing ngrok.',
    keyTakeaways: [
      'Forward captured events to http://localhost:3000 or any custom port.',
      'Preserves original headers, query params, and raw JSON body.',
      'Zero binary installation or tunnel authentication tokens.',
      'One-liner Node.js and Python SSE streaming scripts included.'
    ],
    targetQueries: [
      'forward webhook to localhost',
      'replay webhook to local server',
      'test webhooks without ngrok',
      'send webhook to localhost 3000',
      'webhook local proxy free'
    ],
    benefits: [
      'Forward captured events to http://localhost:3000 or any custom port',
      'Preserves original headers, query params, and raw JSON body',
      'Zero binary installation or tunnel authentication tokens',
      'One-liner Node.js and Python SSE streaming scripts included'
    ],
    practicalGuide: [
      'Capture an incoming webhook in SafeWebhook.',
      'Click the "Replay" button on the request card.',
      'Enter your local endpoint URL (e.g., http://localhost:3000/api/webhook).',
      'Click "Dispatch Replay" to send the identical payload locally.'
    ],
    codeSnippet: `// 1-Liner SSE Forwarder to stream webhooks directly to localhost
import EventSource from 'eventsource';

const es = new EventSource('https://safewebhook.com/api/stream/YOUR_ENDPOINT_ID');
es.onmessage = async (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'request') {
    await fetch('http://localhost:3000/api/webhook', {
      method: data.method,
      headers: data.headers,
      body: data.body
    });
    console.log(\`Forwarded \${data.id} to localhost:3000\`);
  }
};`,
    faqs: [
      {
        q: 'Does localhost replay work if my dev server is behind a VPN or firewall?',
        a: 'Yes! The replay request is initiated directly from your local browser window to your localhost port, so no external ports need to be exposed.'
      }
    ]
  },
  'inbound-email-testing': {
    slug: 'inbound-email-testing',
    name: 'Inbound Email Webhook Ingestion & Parser',
    headline: 'Receive real emails at your unique endpoint and inspect parsed MIME payloads as JSON webhooks',
    description: 'Every SafeWebhook endpoint includes a matching email address (e.g. ep_xyz@inbound.safewebhook.com) to test email notification pipelines and magic link flows.',
    directAnswer: 'Every SafeWebhook endpoint automatically provisions a matching email address. Emails sent to this address are parsed into structured JSON webhooks (with sender, subject, HTML, plaintext, and attachments) and streamed to your dashboard.',
    keyTakeaways: [
      'Unique matching @inbound.safewebhook.com address for every session.',
      'Parses MIME headers, SPF/DKIM authentication, HTML, and attachments.',
      'Test user verification emails, password resets, and magic links.',
      'Instant JSON conversion for automated testing.'
    ],
    targetQueries: [
      'test email webhook online',
      'inbound email parser test',
      'receive email as webhook free',
      'email to webhook debugger',
      'catch transactional email online'
    ],
    benefits: [
      'Unique matching @inbound.safewebhook.com address for every session',
      'Parses MIME headers, SPF/DKIM authentication, HTML, and attachments',
      'Test user verification emails, password resets, and magic links',
      'Instant JSON conversion for automated testing'
    ],
    practicalGuide: [
      'Open SafeWebhook and copy your matching Inbound Email Address.',
      'Send a test email from your email client or app.',
      'Watch the parsed JSON payload stream live into your timeline.',
      'Inspect parsed body, headers, and attachments in real-time.'
    ],
    codeSnippet: `// Example parsed email webhook structure received in SafeWebhook
{
  "from": "Alex Developer <alex@example.com>",
  "to": "ep_live_demo@inbound.safewebhook.com",
  "subject": "Your Magic Login Code: 492019",
  "text": "Your authentication code is 492019. It expires in 10 minutes.",
  "html": "<p>Your authentication code is <strong>492019</strong>.</p>",
  "spf": "pass",
  "dkim": "pass"
}`,
    faqs: [
      {
        q: 'Can I use the inbound email address to test automated signup workflows?',
        a: 'Yes. You can supply the generated email address in your automated E2E tests (Playwright, Cypress) and inspect the incoming magic link via SafeWebhook edge API.'
      }
    ]
  },
  'webhook-to-slack': {
    slug: 'webhook-to-slack',
    name: 'Webhook to Slack Forwarder',
    headline: 'Automatically transform and route incoming webhook payloads to Slack channels with rich formatting',
    description: 'Convert Stripe payment alerts, GitHub pull requests, and Shopify orders into formatted Slack blocks with zero backend code on safewebhook.com.',
    directAnswer: 'SafeWebhook includes automated forwarding workflows to transform incoming webhook payloads and route them directly to your Slack Incoming Webhook URLs with custom formatting.',
    keyTakeaways: [
      'Forward events to any Slack Incoming Webhook URL.',
      'Transform payloads into Slack Block Kit formatting.',
      'Filter events before routing (e.g. only successful payments).',
      'No middleware or serverless functions required.'
    ],
    targetQueries: [
      'forward webhook to slack channel',
      'route stripe webhook to slack',
      'github webhook slack notifier free',
      'webhook to slack forwarder'
    ],
    benefits: [
      'Forward events to any Slack Incoming Webhook URL',
      'Transform payloads into Slack Block Kit formatting',
      'Filter events before routing (e.g. only successful payments)',
      'No middleware or serverless functions required'
    ],
    practicalGuide: [
      'Create an Incoming Webhook in your Slack workspace.',
      'In SafeWebhook, open the Workflows tab and choose "Forward to Slack".',
      'Paste your Slack Webhook URL and select event filters.',
      'Trigger a test webhook to verify the Slack message delivery.'
    ],
    codeSnippet: `// Slack Block Kit formatted message generated by SafeWebhook
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "💳 New Stripe Payment Received" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Amount:* $49.00 USD" },
        { "type": "mrkdwn", "text": "*Customer:* customer@example.com" }
      ]
    }
  ]
}`,
    faqs: [
      {
        q: 'Can I filter which webhooks get sent to Slack?',
        a: 'Yes, SafeWebhook allows you to filter events by HTTP method, event type, or specific JSON key values.'
      }
    ]
  },
  'webhook-to-discord': {
    slug: 'webhook-to-discord',
    name: 'Webhook to Discord Router',
    headline: 'Route inbound webhooks to Discord channels with custom color-coded embeds',
    description: 'Transform GitHub commits, deployment notifications, and customer signup events into clean Discord embeds instantly on safewebhook.com.',
    directAnswer: 'Route any webhook to Discord using SafeWebhook’s automated Discord forwarder. Incoming events are converted to Discord embed cards and dispatched to your Discord Webhook URL.',
    keyTakeaways: [
      'Send color-coded Discord embeds from any webhook provider.',
      'Support for Discord Webhook avatar, username, and embed fields.',
      '100% client-side configuration with edge dispatch.',
      'Zero cost, unlimited alerts.'
    ],
    targetQueries: [
      'route webhook to discord channel',
      'forward webhook to discord embed',
      'github webhook discord bot',
      'shopify order discord notification'
    ],
    benefits: [
      'Send color-coded Discord embeds from any webhook provider',
      'Support for Discord Webhook avatar, username, and embed fields',
      '100% client-side configuration with edge dispatch',
      'Zero cost, unlimited alerts'
    ],
    practicalGuide: [
      'In Discord, go to Channel Settings > Integrations > Webhooks > New Webhook.',
      'Copy the Discord Webhook URL.',
      'In SafeWebhook, enable the Discord Router workflow and paste the URL.',
      'Send a test event to see the formatted embed in your Discord channel.'
    ],
    codeSnippet: `// Discord Embed payload generated by SafeWebhook
{
  "username": "SafeWebhook Bot",
  "avatar_url": "https://safewebhook.com/favicon.svg",
  "embeds": [
    {
      "title": "🚀 New GitHub Release Published",
      "description": "Version **v2.4.0** was published by **octocat**",
      "color": 5814783,
      "timestamp": "2026-08-19T12:00:00.000Z"
    }
  ]
}`,
    faqs: [
      {
        q: 'Does SafeWebhook store my Discord webhook token?',
        a: 'No. Workflow configurations are stored exclusively in your local browser storage and dispatched securely.'
      }
    ]
  },
  'cron-uptime-monitor': {
    slug: 'cron-uptime-monitor',
    name: 'Free Webhook Cron & Uptime Heartbeat Monitor',
    headline: 'Monitor background cron jobs, backup scripts, and workers with dead-man switch alerts',
    description: 'Ping your SafeWebhook endpoint from scheduled cron jobs and receive immediate alerts if a backup or batch worker fails to run.',
    directAnswer: 'SafeWebhook acts as a heartbeat monitor and dead-man switch. Ping your endpoint at the end of scheduled cron jobs, backups, or batch scripts to track execution health and uptime.',
    keyTakeaways: [
      'Ping via simple cURL or HTTP GET/POST at end of cron jobs.',
      'Track timestamp history, execution duration, and success rates.',
      'Zero setup: no monitoring agent installation needed.',
      'Works with AWS Lambda, Cloudflare Cron Triggers, and Linux crontab.'
    ],
    targetQueries: [
      'free cron webhook uptime monitor',
      'dead man switch webhook',
      'heartbeat monitoring webhook',
      'cron job failure alert free',
      'monitor scheduled tasks webhook'
    ],
    benefits: [
      'Ping via simple cURL or HTTP GET/POST at end of cron jobs',
      'Track timestamp history, execution duration, and success rates',
      'Zero setup: no monitoring agent installation needed',
      'Works with AWS Lambda, Cloudflare Cron Triggers, and Linux crontab'
    ],
    practicalGuide: [
      'Add a cURL command at the end of your bash script or cron task.',
      'Set the ping URL to your SafeWebhook endpoint.',
      'Check the timeline in SafeWebhook to verify consistent heartbeat execution.',
      'Set simulated error responses to test your alert notification chains.'
    ],
    codeSnippet: `#!/bin/bash
# Ping SafeWebhook on successful backup completion
if /usr/local/bin/backup-database.sh; then
  curl -s "https://safewebhook.com/api/r/YOUR_ENDPOINT_ID?status=success&job=db_backup"
else
  curl -s -X POST "https://safewebhook.com/api/r/YOUR_ENDPOINT_ID" \\
    -H "Content-Type: application/json" \\
    -d '{"status": "failed", "error": "Database backup exited with error code 1"}'
fi`,
    faqs: [
      {
        q: 'How can I monitor Linux cron jobs with SafeWebhook?',
        a: 'Append `&& curl -s https://safewebhook.com/api/r/YOUR_ID` to your crontab line so a ping is dispatched whenever the job finishes successfully.'
      }
    ]
  },
  'jwt-webhook-validator': {
    slug: 'jwt-webhook-validator',
    name: 'JWT Webhook Token & Claims Validator',
    headline: 'Inspect, decode, and verify JSON Web Token (JWT) authorization headers in inbound webhooks',
    description: 'Debug OAuth 2.0 bearer tokens, parse decoded JWT claims (iss, sub, exp, aud), and verify public key signatures on safewebhook.com.',
    directAnswer: 'SafeWebhook automatically detects and decodes JWT tokens in `Authorization: Bearer <token>` headers. View decoded headers, claims, expiration timestamps, and verify cryptographic RS256/HS256 signatures.',
    keyTakeaways: [
      'Auto-decodes JWT Header, Payload, and Signature components.',
      'Validates expiration timestamps (exp) and clock skew in real-time.',
      'Verify asymmetric RS256 / ES256 and symmetric HS256 tokens.',
      'Zero server-side retention protects sensitive bearer tokens.'
    ],
    targetQueries: [
      'jwt webhook validator online',
      'verify jwt token webhook',
      'decode bearer token webhook',
      'oauth2 webhook debugger',
      'jwt signature verification online'
    ],
    benefits: [
      'Auto-decodes JWT Header, Payload, and Signature components',
      'Validates expiration timestamps (exp) and clock skew in real-time',
      'Verify asymmetric RS256 / ES256 and symmetric HS256 tokens',
      'Zero server-side retention protects sensitive bearer tokens'
    ],
    practicalGuide: [
      'Send a request containing an Authorization: Bearer <JWT> header to SafeWebhook.',
      'Click the request in your timeline and navigate to the "Headers" inspector.',
      'SafeWebhook displays the decoded JSON claims and signature status.',
      'Export the verification script to implement in your production gateway.'
    ],
    codeSnippet: `// Node.js JWT Verification with jsonwebtoken
import jwt from 'jsonwebtoken';

export function verifyWebhookJwt(authHeader, publicKey) {
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    console.log('Valid JWT Subject:', decoded.sub);
    return decoded;
  } catch (err) {
    console.error('Invalid JWT:', err.message);
    return null;
  }
}`,
    faqs: [
      {
        q: 'Can SafeWebhook verify JWKS (JSON Web Key Set) endpoints?',
        a: 'Yes. You can paste your JWKS URI into our validation helper to fetch the corresponding public key and verify RS256 signatures.'
      }
    ]
  },
  'payload-formatter': {
    slug: 'payload-formatter',
    name: 'Webhook JSON Payload Formatter & Diff Tool',
    headline: 'Format, beautify, minify, and compare complex nested webhook JSON payloads online',
    description: 'Clean up minified webhook payloads, search deeply nested keys, and highlight payload differences between production and staging events on safewebhook.com.',
    directAnswer: 'SafeWebhook includes a built-in JSON Formatter and visual diff engine. Beautify raw minified JSON, filter keys with JSONPath queries, and compare two webhook payloads side-by-side.',
    keyTakeaways: [
      'Instant JSON syntax formatting and error validation.',
      'Visual Side-by-Side Diff engine to compare payloads.',
      'JSONPath filter query bar for deep nested object search.',
      'Export as minified JSON, TypeScript types, or cURL.'
    ],
    targetQueries: [
      'webhook json formatter online',
      'beautify webhook payload',
      'compare webhook payloads diff',
      'json validator for webhooks',
      'jsonpath webhook search tool'
    ],
    benefits: [
      'Instant JSON syntax formatting and error validation',
      'Visual Side-by-Side Diff engine to compare payloads',
      'JSONPath filter query bar for deep nested object search',
      'Export as minified JSON, TypeScript types, or cURL'
    ],
    practicalGuide: [
      'Capture any JSON webhook in SafeWebhook.',
      'Use the tree viewer to collapse and expand nested objects.',
      'Select two requests in the timeline and click "Compare / Diff" to view changes.',
      'Click "Export Types" to generate TypeScript interfaces for the payload.'
    ],
    codeSnippet: `// Generated TypeScript interface from SafeWebhook JSON Formatter
export interface WebhookEventPayload {
  id: string;
  event: string;
  created_at: number;
  data: {
    customer_id: string;
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed' | 'pending';
  };
}`,
    faqs: [
      {
        q: 'Can I generate TypeScript interfaces from captured payloads?',
        a: 'Yes! SafeWebhook analyzes the structure and types of your incoming JSON payload and automatically generates clean TypeScript definitions.'
      }
    ]
  },
  'rate-limit-backoff-tester': {
    slug: 'rate-limit-backoff-tester',
    name: 'Webhook Rate Limit & Exponential Backoff Tester',
    headline: 'Test HTTP 429 Too Many Requests responses and Retry-After headers to verify upstream retry policies',
    description: 'Ensure your upstream webhook sender (Stripe, GitHub, Shopify) respects HTTP 429 rate limits and implements proper exponential backoff without dropping events on safewebhook.com.',
    directAnswer: 'SafeWebhook lets you simulate HTTP 429 Too Many Requests with customizable Retry-After headers (e.g. `Retry-After: 120`). Test that upstream webhook producers back off gracefully rather than flooding your server.',
    keyTakeaways: [
      'Simulate HTTP 429 Too Many Requests status code.',
      'Configure custom Retry-After headers (in seconds or HTTP dates).',
      'Inspect provider retry intervals and backoff curves.',
      'Zero code needed to configure rate limit tests.'
    ],
    targetQueries: [
      'test webhook 429 rate limit',
      'simulate retry after webhook',
      'exponential backoff webhook testing',
      'test stripe 429 retry behavior',
      'mock rate limited webhook endpoint'
    ],
    benefits: [
      'Simulate HTTP 429 Too Many Requests status code',
      'Configure custom Retry-After headers (in seconds or HTTP dates)',
      'Inspect provider retry intervals and backoff curves',
      'Zero code needed to configure rate limit tests'
    ],
    practicalGuide: [
      'In SafeWebhook, open the Response Config tab.',
      'Set the HTTP Status Code to 429 Too Many Requests.',
      'Add the header "Retry-After: 60" and save.',
      'Trigger an event from your webhook provider and monitor their retry cadence in the timeline.'
    ],
    codeSnippet: `// Example HTTP 429 Rate Limit Response configured in SafeWebhook
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0

{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please retry in 60 seconds."
}`,
    faqs: [
      {
        q: 'How does Stripe handle HTTP 429 responses from webhooks?',
        a: 'Stripe treats HTTP 429 as a temporary failure and schedules retries over a 72-hour period with exponential backoff.'
      }
    ]
  },
  'ipn-simulator': {
    slug: 'ipn-simulator',
    name: 'Instant Payment Notification (IPN) Simulator',
    headline: 'Simulate and verify legacy IPN and URL-encoded webhook callbacks with zero registration',
    description: 'Debug legacy payment gateway Instant Payment Notifications (PayPal IPN, Authorize.Net, 2Checkout) on safewebhook.com with instant form data decoding.',
    directAnswer: 'SafeWebhook supports raw `application/x-www-form-urlencoded` payloads used by legacy payment gateways (PayPal IPN, Authorize.Net, Worldpay). Inspect decoded key-value pairs and generate validation scripts.',
    keyTakeaways: [
      'Full support for URL-encoded and multipart form data.',
      'Decodes txn_id, payment_status, mc_gross, and custom parameters.',
      'Generate IPN validation POST handshake scripts.',
      '100% private, browser-based inspection.'
    ],
    targetQueries: [
      'paypal ipn simulator free',
      'test instant payment notification online',
      'mock ipn listener free',
      'url encoded webhook debugger',
      'authorize net webhook tester'
    ],
    benefits: [
      'Full support for URL-encoded and multipart form data',
      'Decodes txn_id, payment_status, mc_gross, and custom parameters',
      'Generate IPN validation POST handshake scripts',
      '100% private, browser-based inspection'
    ],
    practicalGuide: [
      'Set your payment gateway IPN URL to your SafeWebhook endpoint.',
      'Execute a simulated transaction in sandbox mode.',
      'SafeWebhook decodes the form parameters into a readable key-value table.',
      'Use the Replay Drawer to send the IPN payload to your local receiver.'
    ],
    codeSnippet: `// Node.js PayPal IPN Validation Handshake
import fetch from 'node-fetch';

export async function validatePayPalIpn(rawBody) {
  const verifyBody = 'cmd=_notify-validate&' + rawBody;
  const res = await fetch('https://ipnpb.sandbox.paypal.com/cgi-bin/webscr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verifyBody
  });
  const text = await res.text();
  return text === 'VERIFIED';
}`,
    faqs: [
      {
        q: 'Why do legacy payment gateways require an IPN validation handshake?',
        a: 'Legacy IPN systems do not sign payloads with HMAC headers; instead, the receiver must post the entire raw body back to the gateway to confirm authenticity.'
      }
    ]
  }
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES);
