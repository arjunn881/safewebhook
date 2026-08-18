export interface ToolUseCase {
  slug: string;
  name: string;
  headline: string;
  description: string;
  targetQueries: string[];
  benefits: string[];
  practicalGuide: string[];
  codeSnippet: string;
  faqs: Array<{ q: string; a: string }>;
}

export const USE_CASES: Record<string, ToolUseCase> = {
  'mock-api-response': {
    slug: 'mock-api-response',
    name: 'Custom Webhook Status Code & Response Simulator',
    headline: 'Simulate HTTP 200, 201, 400, 429, and 500 error responses for any webhook call',
    description: 'Easily test how your third-party providers (Stripe, GitHub, Shopify) react when your backend endpoint returns errors, custom JSON schemas, or empty 204 responses on safewebhook.com.',
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
    name: 'HMAC Webhook Signature Inspector & Verifier',
    headline: 'Inspect and verify cryptographic webhook signatures across all major providers',
    description: 'Verify HMAC-SHA256, HMAC-SHA1, and Ed25519 webhook signatures from Stripe, GitHub, Shopify, Slack, and PayPal without writing custom boilerplate on safewebhook.com.',
    targetQueries: [
      'verify webhook signature online',
      'inspect stripe signature header',
      'test hmac sha256 webhook',
      'verify github x-hub-signature',
      'shopify hmac validator online'
    ],
    benefits: [
      'Instant header breakdown of timestamp and signature hash',
      'Copy-paste verification code snippets for Node.js, Python, and Go',
      'Support for Stripe, GitHub, Shopify, Slack, Twilio, Discord, and Svix',
      'Timing-safe signature verification checks'
    ],
    practicalGuide: [
      'Send a signed webhook from Stripe, GitHub, or Shopify to your SafeWebhook endpoint.',
      'Click on the captured request in your timeline.',
      'Select the "Security & Signature" tab in the inspector panel.',
      'View the extracted signature hash, timestamp, and implementation guide.'
    ],
    codeSnippet: `// Universal Node.js HMAC Verification Snippet
const crypto = require('crypto');

function verifyHMAC(rawBody, signatureHeader, secretKey) {
  const hash = crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
}`,
    faqs: [
      {
        q: 'Why should I always verify webhook signatures?',
        a: 'Signature verification ensures that inbound webhook payloads were genuinely crafted by the provider (e.g. Stripe) and were not tampered with by an attacker (Man-in-the-Middle).'
      }
    ]
  },
  'replay-to-localhost': {
    slug: 'replay-to-localhost',
    name: 'Localhost Webhook Replay & Forwarding Proxy',
    headline: 'Replay captured live webhooks directly to your local development server with 1-click',
    description: 'Debug locally without third-party tunnel binaries. Capture real production webhooks in SafeWebhook and replay them directly into `http://localhost:8000/webhook`.',
    targetQueries: [
      'forward webhook to localhost',
      'replay webhook to local server',
      'test webhook without ngrok',
      'resend webhook payload',
      'local webhook debugging proxy'
    ],
    benefits: [
      '1-Click Replay modal with custom destination URL',
      'Inspect roundtrip execution latency (in milliseconds)',
      'View local backend response status code and response body',
      'Modify headers or payload before re-dispatching'
    ],
    practicalGuide: [
      'Capture any live webhook in the SafeWebhook dashboard.',
      'Click the "Replay" action button on the request card.',
      'Enter your local endpoint (e.g., http://localhost:8000/api/webhook).',
      'Click "Dispatch Replay" and inspect the real-time execution result.'
    ],
    codeSnippet: `// Node.js zero-install background forwarder to localhost
const es = new EventSource('https://safewebhook.com/api/stream/YOUR_ENDPOINT_ID');

es.onmessage = async (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'connected' || data.type === 'ping') return;

  console.log(\`Forwarding \${data.method} to localhost:8000...\`);
  await fetch('http://localhost:8000/api/webhook', {
    method: data.method,
    headers: data.headers,
    body: data.body
  });
};`,
    faqs: [
      {
        q: 'Can I replay a webhook multiple times?',
        a: 'Yes, you can replay the exact same captured payload as many times as you need to test different branches of your local code.'
      }
    ]
  },
  'inbound-email-testing': {
    slug: 'inbound-email-testing',
    name: 'Inbound Email Webhook Tester & Debugger',
    headline: 'Receive, inspect, and parse inbound emails and transactional notifications in real-time',
    description: 'Every SafeWebhook endpoint comes with a matching email address to test inbound email parsers, SendGrid, Mailgun, and SES event callbacks on safewebhook.com.',
    targetQueries: [
      'test email webhook online',
      'inbound email parser test',
      'mock email webhook endpoint',
      'sendgrid inbound parse tester',
      'free inbound email webhook tester'
    ],
    benefits: [
      'Dedicated email address generated instantly for every endpoint',
      'Live parsing of Sender, Subject, HTML body, and Plaintext body',
      'Instant attachment header detection',
      'Real-time streaming via Server-Sent Events'
    ],
    practicalGuide: [
      'Copy your endpoint email address from the top bar.',
      'Send a test email from Gmail, Outlook, or your transactional email client.',
      'Watch the email appear as a structured POST request inside your timeline within 500ms.'
    ],
    codeSnippet: `// Post an email webhook event to SafeWebhook
await fetch('https://safewebhook.com/api/email/YOUR_ENDPOINT_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: "alice@example.com",
    to: "ep_dev_9a7d3b@safewebhook.com",
    subject: "Order Confirmation #4092",
    text: "Your order has shipped successfully.",
    html: "<p>Your order has shipped successfully.</p>"
  })
});`,
    faqs: [
      {
        q: 'How are inbound emails delivered to my browser?',
        a: 'Inbound emails are automatically converted into standard JSON webhook events and streamed directly to your active browser session over SSE.'
      }
    ]
  },
  'webhook-to-slack': {
    slug: 'webhook-to-slack',
    name: 'Webhook to Slack Forwarder & Alert System',
    headline: 'Automatically route and forward filtered webhook events straight to Slack channels',
    description: 'Build real-time Slack notification alerts from Stripe payments, GitHub releases, or custom API events with zero backend code required on safewebhook.com.',
    targetQueries: [
      'forward webhook to slack channel',
      'stripe webhook to slack alert',
      'send webhook payload to slack',
      'webhook to slack bot integration',
      'slack incoming webhook tester'
    ],
    benefits: [
      'Transform raw JSON payloads into clean Slack Markdown messages',
      'Filter triggers by HTTP method, event type, or body properties',
      'Test Slack Incoming Webhook URLs live without writing server scripts',
      'Sub-50ms execution speed directly from the edge'
    ],
    practicalGuide: [
      'Create an Incoming Webhook in your Slack Workspace settings.',
      'In the SafeWebhook dashboard, open the "Workflows" tab.',
      'Select the "Forward to Slack" action template.',
      'Paste your Slack Webhook URL and choose your trigger condition.',
      'Save the rule and trigger an incoming webhook.'
    ],
    codeSnippet: `// Example JavaScript Transformer for Slack Block Kit
function transformForSlack(webhook) {
  return {
    text: \`New Webhook: \${webhook.method} \${webhook.path}\`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: \`*Alert:* Inbound event received from *\${webhook.ip}*\`
        }
      }
    ]
  };
}`,
    faqs: [
      {
        q: 'Can I filter which webhooks trigger a Slack alert?',
        a: 'Yes, you can set conditions in the Workflows tab so alerts only trigger for specific events like payment_intent.succeeded or errors.'
      }
    ]
  },
  'webhook-to-discord': {
    slug: 'webhook-to-discord',
    name: 'Webhook to Discord Embed Forwarder',
    headline: 'Send rich Discord embeds from incoming webhook events instantly',
    description: 'Forward payment confirmations, deploy alerts, and server notifications directly into Discord channels using Discord Webhook URLs on safewebhook.com.',
    targetQueries: [
      'route webhook to discord channel',
      'github webhook to discord embed',
      'stripe payments discord notification',
      'discord webhook forwarder online',
      'test discord webhook embed'
    ],
    benefits: [
      'Automatic conversion of JSON data into rich Discord Embeds',
      'Custom color badges based on status (e.g. green for 200, red for errors)',
      'Include field summaries like Amount, Customer, or Commit hash',
      'Zero bot token setup needed — uses standard Discord Webhook URLs'
    ],
    practicalGuide: [
      'In Discord Channel Settings > Integrations > Webhooks, create a Webhook and copy URL.',
      'In SafeWebhook Workflows, enter your Discord Webhook URL.',
      'Configure whether you want full JSON dump or styled Embeds.',
      'Save workflow and send test requests.'
    ],
    codeSnippet: `// Example Discord Embed Payload
const discordPayload = {
  username: "SafeWebhook Bot",
  embeds: [
    {
      title: "Webhook Captured",
      description: "Received POST payload from Stripe",
      color: 0x06b6d4, // Cyan
      fields: [
        { name: "Event", value: "payment_intent.succeeded", inline: true },
        { name: "Amount", value: "$49.00 USD", inline: true }
      ],
      timestamp: new Date().toISOString()
    }
  ]
};`,
    faqs: [
      {
        q: 'Can I use this for GitHub release alerts to Discord?',
        a: 'Yes, just set your GitHub webhook destination to SafeWebhook and configure the Workflow Rule with your Discord webhook URL.'
      }
    ]
  },
  'cron-uptime-monitor': {
    slug: 'cron-uptime-monitor',
    name: 'Webhook Uptime & Health Check Monitor',
    headline: 'Schedule periodic automated health checks and test SSL certificate latency',
    description: 'Ensure your webhook endpoints and API backends are online 24/7 with automated status checks, latency measurement, and SSL verification on safewebhook.com.',
    targetQueries: [
      'free cron webhook uptime monitor',
      'check webhook endpoint health online',
      'api ping tester with latency',
      'test ssl certificate validity webhook',
      'automated webhook heartbeat'
    ],
    benefits: [
      'Measure DNS, TLS handshake, and total roundtrip response time',
      'Verify HTTPS TLS 1.3 encryption and certificate validity',
      'Detect 502 Bad Gateway and 504 Gateway Timeout regressions immediately',
      '100% free tool with no installation required'
    ],
    practicalGuide: [
      'In SafeWebhook, open the "Monitor" tab.',
      'Enter your API or Webhook destination URL.',
      'Click "Run Health Check Ping".',
      'Inspect detailed metrics including response time in ms, status code, and TLS status.'
    ],
    codeSnippet: `// Trigger Health Check Ping via Edge Monitor API
const res = await fetch('https://safewebhook.com/api/monitor', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://api.yourdomain.com/health',
    method: 'GET'
  })
});
const health = await res.json();
console.log('Status:', health.status, 'Response Time:', health.response_time_ms + 'ms');`,
    faqs: [
      {
        q: 'How often can I run health checks?',
        a: 'You can trigger checks on demand anytime directly from the browser or via automated scripts targeting our edge monitor endpoint.'
      }
    ]
  }
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES);
