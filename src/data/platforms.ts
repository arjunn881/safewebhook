export interface PlatformIntegration {
  slug: string;
  name: string;
  category: 'Payments' | 'Developer Tools' | 'E-Commerce' | 'Messaging & Communications' | 'Authentication & Cloud' | 'AI & Automation' | 'Productivity & CRM';
  signatureHeader: string;
  signatureAlgorithm: string;
  tagline: string;
  description: string;
  directAnswer?: string;
  keyTakeaways?: string[];
  sampleEvents: string[];
  setupSteps: string[];
  samplePayload: Record<string, unknown> | Array<unknown>;
  verificationCodeNode: string;
  verificationCodePython: string;
  faqs: Array<{ q: string; a: string }>;
}

export type PlatformInfo = PlatformIntegration;

export const PLATFORMS: Record<string, PlatformIntegration> = {
  'stripe': {
    slug: 'stripe',
    name: 'Stripe',
    category: 'Payments',
    signatureHeader: 'Stripe-Signature',
    signatureAlgorithm: 'HMAC-SHA256 (timestamped scheme)',
    tagline: 'Test Stripe payment webhooks, subscription lifecycle events, and verify signatures locally without login on SafeWebhook.',
    description: 'Debug and inspect inbound Stripe webhooks in real-time. Verify `customer.subscription.created`, `payment_intent.succeeded`, and simulate charge failures with custom HTTP responses on safewebhook.com.',
    directAnswer: 'To test Stripe webhooks, copy your free SafeWebhook URL from safewebhook.com, register it under Stripe Dashboard > Developers > Webhooks, and trigger a workbench event. SafeWebhook captures the raw JSON payload and Stripe-Signature header instantly without server storage.',
    keyTakeaways: [
      'Zero-login setup: get an edge endpoint instantly at safewebhook.com.',
      'Live Stripe-Signature extraction and timestamp verification.',
      '1-Click replay to localhost:3000 or localhost:8000 without ngrok.',
      'Simulate HTTP 500 error responses to test Stripe exponential backoff retries.'
    ],
    sampleEvents: [
      'customer.subscription.created',
      'payment_intent.succeeded',
      'invoice.payment_failed',
      'charge.dispute.created',
      'checkout.session.completed'
    ],
    setupSteps: [
      'Navigate to your Stripe Dashboard > Developers > Webhooks.',
      'Click "Add endpoint" and paste your unique SafeWebhook URL from safewebhook.com.',
      'Select the events to listen for (e.g. payment_intent.succeeded, customer.subscription.created).',
      'Click "Add endpoint" to save. Trigger a test event directly from the Stripe Workbench.'
    ],
    samplePayload: {
      id: 'evt_1Ng3242eZvKYlo2C',
      object: 'event',
      api_version: '2024-06-20',
      created: 1755541200,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_3Ng3242eZvKYlo2C0abc',
          object: 'payment_intent',
          amount: 4900,
          currency: 'usd',
          status: 'succeeded',
          customer: 'cus_Oq7J8h21K'
        }
      }
    },
    verificationCodeNode: `const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('Verified Stripe Event:', event.type);
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(\`Webhook Error: \${err.message}\`);
  }
});`,
    verificationCodePython: `import stripe
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = 'whsec_...'

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400`,
    faqs: [
      {
        q: 'How do I test Stripe webhooks on localhost without installing the Stripe CLI?',
        a: 'Paste your SafeWebhook endpoint into the Stripe Dashboard, and use our built-in Replay Drawer to forward incoming events straight to http://localhost:8000/webhook with identical raw bodies and headers.'
      },
      {
        q: 'How does SafeWebhook verify Stripe-Signature headers?',
        a: 'SafeWebhook auto-detects the Stripe-Signature header, extracts the timestamp (t=...) and v1 signature hash, and displays ready-to-run verification recipes.'
      },
      {
        q: 'Why does Stripe webhook signature verification fail in Node.js?',
        a: 'The most common cause is parsing the body as JSON prior to verification. Stripe signature hashing requires the exact, unmodified raw UTF-8 string or Buffer.'
      }
    ]
  },
  'github': {
    slug: 'github',
    name: 'GitHub',
    category: 'Developer Tools',
    signatureHeader: 'X-Hub-Signature-256',
    signatureAlgorithm: 'HMAC-SHA256',
    tagline: 'Inspect GitHub repository webhooks, pull requests, CI/CD ping events, and verify X-Hub-Signature-256 with zero signup.',
    description: 'Capture and debug GitHub repository push, pull_request, workflow_run, and release events in real time. Validate HMAC-SHA256 signatures with live code snippets.',
    directAnswer: 'To debug GitHub webhooks, paste your unique SafeWebhook URL into your GitHub Repo > Settings > Webhooks, select your secret token, and click Add Webhook. GitHub will send an immediate ping event that streams straight to your browser.',
    keyTakeaways: [
      'Instant GitHub ping event capture with full X-GitHub-Event header inspectability.',
      'HMAC-SHA256 signature verification matching GitHub secret keys.',
      'Works seamlessly for GitHub Actions and GitHub App webhooks.',
      'Sub-20ms edge latency via Cloudflare edge streaming.'
    ],
    sampleEvents: [
      'push',
      'pull_request.opened',
      'pull_request.closed',
      'workflow_run.completed',
      'issues.opened',
      'release.published'
    ],
    setupSteps: [
      'Go to your GitHub repository > Settings > Webhooks > Add webhook.',
      'Paste your SafeWebhook URL into the "Payload URL" field.',
      'Set "Content type" to application/json.',
      'Input a Secret token (or leave blank for public testing), select "Send me everything", and click "Add webhook".'
    ],
    samplePayload: {
      action: 'opened',
      issue: {
        url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347',
        number: 1347,
        title: 'Found a bug in deployment pipeline',
        user: { login: 'octocat', id: 1 },
        state: 'open'
      },
      repository: {
        name: 'Hello-World',
        full_name: 'octocat/Hello-World',
        private: false
      },
      sender: { login: 'octocat' }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyGitHubWebhook(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_github_signature(raw_body, signature_header, secret):
    if not signature_header:
        return False
    
    sha_name, signature = signature_header.split('=')
    if sha_name != 'sha256':
        return False
        
    mac = hmac.new(secret.encode('utf-8'), msg=raw_body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)`,
    faqs: [
      {
        q: 'What is the X-Hub-Signature-256 header in GitHub webhooks?',
        a: 'It is an HMAC-SHA256 hex digest generated using your repository secret as the key and the raw JSON payload as the message.'
      },
      {
        q: 'How can I simulate GitHub Actions webhooks?',
        a: 'You can use the SafeWebhook Workbench Replay Drawer or cURL export to send simulated workflow_run events directly to your receiver.'
      }
    ]
  },
  'shopify': {
    slug: 'shopify',
    name: 'Shopify',
    category: 'E-Commerce',
    signatureHeader: 'X-Shopify-Hmac-Sha256',
    signatureAlgorithm: 'HMAC-SHA256 (Base64-encoded)',
    tagline: 'Test Shopify store webhooks, order fulfillment, refund events, and verify Base64 HMAC signatures without login.',
    description: 'Receive and inspect Shopify orders/create, products/update, and customer privacy webhooks on safewebhook.com with instant payload formatting.',
    directAnswer: 'To test Shopify store webhooks, configure your SafeWebhook endpoint URL in Shopify Admin > Settings > Notifications > Webhooks or via Shopify CLI / App Partner dashboard. Events stream live to your screen with automatic Base64 HMAC verification.',
    keyTakeaways: [
      'Live decoding of X-Shopify-Topic and X-Shopify-Shop-Domain headers.',
      'Base64-encoded HMAC-SHA256 signature verification generator.',
      'Test GDPR/compliance mandatory webhooks (customers/data_request, shop/redact).',
      'Export payloads in cURL, Python, Go, and Node.js with 1 click.'
    ],
    sampleEvents: [
      'orders/create',
      'orders/fulfilled',
      'orders/paid',
      'products/update',
      'customers/create',
      'refunds/create'
    ],
    setupSteps: [
      'In Shopify Admin, go to Settings > Notifications > Webhooks.',
      'Click "Create webhook". Select event (e.g. Order creation) and Format "JSON".',
      'Paste your SafeWebhook URL and click Save.',
      'Click "Send test notification" to trigger an instant payload.'
    ],
    samplePayload: {
      id: 820982911946,
      email: 'buyer@example.com',
      total_price: '199.00',
      currency: 'USD',
      financial_status: 'paid',
      line_items: [
        {
          id: 8665503117664,
          title: 'Mechanical Keyboard Pro',
          price: '199.00',
          quantity: 1
        }
      ]
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyShopifyHmac(rawBody, headerHmac, apiSecret) {
  const digest = crypto
    .createHmac('sha256', apiSecret)
    .update(rawBody, 'utf8')
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerHmac));
}`,
    verificationCodePython: `import hmac
import hashlib
import base64

def verify_shopify_signature(raw_body, hmac_header, secret):
    digest = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).digest()
    computed_hmac = base64.b64encode(digest).decode('utf-8')
    return hmac.compare_digest(computed_hmac, hmac_header)`,
    faqs: [
      {
        q: 'Why does Shopify HMAC verification fail in Express?',
        a: 'Shopify hashes the raw binary body before JSON parsing. If bodyParser.json() alters whitespace or key order, the HMAC digest will not match.'
      },
      {
        q: 'What format is the Shopify signature header in?',
        a: 'The X-Shopify-Hmac-Sha256 header contains a Base64-encoded string rather than the standard hex digest used by GitHub.'
      }
    ]
  },
  'openai': {
    slug: 'openai',
    name: 'OpenAI & AI Agents',
    category: 'AI & Automation',
    signatureHeader: 'OpenAI-Signature',
    signatureAlgorithm: 'Webhook Signature Scheme',
    tagline: 'Test OpenAI Assistants, Realtime API, Batch endpoints, and agent callback webhooks in real time.',
    description: 'Inspect asynchronous OpenAI batch processing callbacks, Assistant thread run completion webhooks, and fine-tuning status notifications on SafeWebhook.',
    directAnswer: 'To test OpenAI webhooks, supply your SafeWebhook URL as the webhook callback endpoint in your OpenAI API Batch or Fine-Tuning requests. As soon as OpenAI finishes model inference, the completion payload streams to your browser.',
    keyTakeaways: [
      'Debug async batch generation callbacks (gpt-4o, o3-mini).',
      'Inspect AI Assistant run lifecycle events (thread.run.completed).',
      'Test AI Agent tool function call webhook receivers.',
      'Zero server storage protects model prompts and API response data.'
    ],
    sampleEvents: [
      'batch.completed',
      'batch.failed',
      'thread.run.completed',
      'fine_tuning.job.succeeded',
      'model.evaluation.finished'
    ],
    setupSteps: [
      'Create a SafeWebhook URL at safewebhook.com/app.',
      'Pass the URL in the \`webhook_url\` parameter of your OpenAI Batch API or Assistant run call.',
      'Trigger your model job via OpenAI SDK or REST API.',
      'Inspect the returned completion status, token counts, and output files in SafeWebhook.'
    ],
    samplePayload: {
      id: 'batch_req_9817420194',
      object: 'batch',
      endpoint: '/v1/chat/completions',
      status: 'completed',
      output_file_id: 'file-xyz98234abc',
      request_counts: {
        total: 5000,
        completed: 5000,
        failed: 0
      }
    },
    verificationCodeNode: `// Verify OpenAI Batch / Assistant Webhook
export function handleOpenAIWebhook(req, res) {
  const { status, output_file_id, request_counts } = req.body;
  console.log(\`OpenAI Batch \${status}: \${request_counts.completed} items processed.\`);
  res.status(200).json({ received: true });
}`,
    verificationCodePython: `# Python FastAPI OpenAI Callback Handler
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/openai-webhook")
async def openai_callback(request: Request):
    data = await request.json()
    print(f"OpenAI Batch Status: {data.get('status')}")
    return {"status": "ok"}`,
    faqs: [
      {
        q: 'How does OpenAI send webhook notifications for batch jobs?',
        a: 'When an OpenAI Batch API job transitions to completed, failed, or cancelled, OpenAI makes an HTTP POST request with metadata and result file IDs to your specified URL.'
      },
      {
        q: 'Can I replay OpenAI webhook callbacks to my local development server?',
        a: 'Yes. Use SafeWebhook’s Replay Drawer to send the captured OpenAI batch completion event directly to http://localhost:3000/api/openai-callback.'
      }
    ]
  },
  'whatsapp': {
    slug: 'whatsapp',
    name: 'WhatsApp Cloud API',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Hub-Signature-256',
    signatureAlgorithm: 'HMAC-SHA256 (Meta Scheme)',
    tagline: 'Test Meta WhatsApp Cloud API webhooks, verify hub.challenge tokens, and inspect incoming messages without server setup.',
    description: 'Debug Meta WhatsApp Cloud API incoming messages, message delivery receipts, status updates, and interactive button clicks on SafeWebhook.',
    directAnswer: 'To test WhatsApp Cloud API webhooks, configure your SafeWebhook URL in Meta for Developers > WhatsApp > Configuration. Complete the verification handshake (hub.challenge) and inspect incoming text, media, and location payloads live.',
    keyTakeaways: [
      'Handles Meta hub.mode, hub.challenge, and hub.verify_token verification.',
      'Inspect nested WhatsApp message structures, phone numbers, and button callbacks.',
      'Validate X-Hub-Signature-256 using your Meta App Secret.',
      'Replay incoming WhatsApp chats to your local bot backend.'
    ],
    sampleEvents: [
      'messages.received',
      'messages.delivered',
      'messages.read',
      'messages.failed',
      'button_reply.clicked'
    ],
    setupSteps: [
      'Open Meta Developer Portal > WhatsApp > Configuration > Edit Webhook.',
      'Paste your SafeWebhook URL into Callback URL and supply a Verify Token.',
      'Configure SafeWebhook Response Config to return the verify_token in plain text for the handshake.',
      'Subscribe to \`messages\` and send a test WhatsApp message from your phone.'
    ],
    samplePayload: {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1098492049281',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '+1555029384', phone_number_id: '102938491029' },
                contacts: [{ profile: { name: 'Alex Developer' }, wa_id: '1555123456' }],
                messages: [{ from: '1555123456', id: 'wamid.HBgLM...', text: { body: 'Hello SafeWebhook' }, type: 'text' }]
              },
              field: 'messages'
            }
          ]
        }
      ]
    },
    verificationCodeNode: `// WhatsApp Cloud API Webhook Verification & Handler
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});`,
    verificationCodePython: `@app.route('/webhook', methods=['GET'])
def verify_whatsapp():
    mode = request.args.get('hub.mode')
    token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    if mode == 'subscribe' and token == 'MY_VERIFY_TOKEN':
        return challenge, 200
    return 'Forbidden', 403`,
    faqs: [
      {
        q: 'Why does Meta WhatsApp require a GET handshake before sending POST webhooks?',
        a: 'Meta performs an initial GET request with hub.challenge and hub.verify_token to verify ownership of the callback URL before dispatching live user events.'
      }
    ]
  },
  'telegram': {
    slug: 'telegram',
    name: 'Telegram Bot API',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Telegram-Bot-Api-Secret-Token',
    signatureAlgorithm: 'Plaintext Secret Token Check',
    tagline: 'Test Telegram Bot update webhooks, inline queries, command payloads, and secret tokens in real time.',
    description: 'Inspect incoming Telegram Bot updates, user commands (/start, /help), photos, and callback queries on SafeWebhook without running a public server.',
    directAnswer: 'To test Telegram Bot webhooks, call \`https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SAFEWEBHOOK_URL>&secret_token=<SECRET>\` in your browser. All Telegram messages sent to your bot will stream into SafeWebhook in real-time.',
    keyTakeaways: [
      'Inspect raw Telegram Update objects (message, callback_query, inline_query).',
      'Validate X-Telegram-Bot-Api-Secret-Token header.',
      'Instant debugging without running polling loops on your laptop.',
      'Export Telegram payloads as cURL or Python requests to build bot handlers.'
    ],
    sampleEvents: [
      'message.text',
      'message.command',
      'callback_query',
      'inline_query',
      'chat_member.updated'
    ],
    setupSteps: [
      'Create a SafeWebhook URL at safewebhook.com/app.',
      'Run: curl -F "url=https://safewebhook.com/api/r/YOUR_ID" -F "secret_token=my_secret" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook',
      'Send a message to your bot inside the Telegram app.',
      'View the complete Update payload live in SafeWebhook.'
    ],
    samplePayload: {
      update_id: 10000,
      message: {
        message_id: 1365,
        from: { id: 1111111, is_bot: false, first_name: 'John', username: 'johndoe' },
        chat: { id: 1111111, first_name: 'John', username: 'johndoe', type: 'private' },
        date: 1755541200,
        text: '/start welcome_ref'
      }
    },
    verificationCodeNode: `// Verify Telegram Secret Token
app.post('/telegram-webhook', (req, res) => {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret !== process.env.TELEGRAM_SECRET_TOKEN) {
    return res.status(403).send('Unauthorized');
  }
  const update = req.body;
  console.log('Received Telegram message:', update.message?.text);
  res.sendStatus(200);
});`,
    verificationCodePython: `from flask import Flask, request, abort

@app.route('/telegram-webhook', methods=['POST'])
def telegram_webhook():
    secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if secret != 'MY_SECRET_TOKEN':
        abort(403)
    update = request.json
    print(f"Message from {update['message']['from']['username']}: {update['message']['text']}")
    return 'ok', 200`,
    faqs: [
      {
        q: 'How do I remove the webhook and switch back to long polling in Telegram?',
        a: 'Call \`https://api.telegram.org/bot<TOKEN>/deleteWebhook\` to reset your bot to getUpdates polling mode.'
      }
    ]
  },
  'razorpay': {
    slug: 'razorpay',
    name: 'Razorpay',
    category: 'Payments',
    signatureHeader: 'X-Razorpay-Signature',
    signatureAlgorithm: 'HMAC-SHA256',
    tagline: 'Test Razorpay payment captured, refund processed, and subscription charged webhooks with signature verification.',
    description: 'Inspect Razorpay payments, refunds, and subscription invoices on safewebhook.com. Verify \`X-Razorpay-Signature\` HMACs instantly.',
    directAnswer: 'To test Razorpay webhooks, navigate to Razorpay Dashboard > Settings > Webhooks, click Add New Webhook, enter your SafeWebhook URL, configure your secret, and trigger simulated payments in Test Mode.',
    keyTakeaways: [
      'Validate X-Razorpay-Signature HMAC-SHA256 with test webhook secrets.',
      'Debug payment.captured, payment.failed, and refund.processed events.',
      'Simulate 500 error codes to verify Razorpay retry mechanism (up to 24 hours).',
      'Private local-only storage ensures customer UPI/card tokens stay safe.'
    ],
    sampleEvents: [
      'payment.authorized',
      'payment.captured',
      'payment.failed',
      'refund.processed',
      'subscription.charged'
    ],
    setupSteps: [
      'Log into Razorpay Dashboard in Test Mode > Settings > Webhooks.',
      'Click "+ Add New Webhook" and enter your SafeWebhook URL.',
      'Enter a Secret key and select events (e.g. payment.captured, payment.failed).',
      'Create a dummy test order on your frontend to trigger live events.'
    ],
    samplePayload: {
      entity: 'event',
      account_id: 'acc_892182410',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_H209384910',
            amount: 50000,
            currency: 'INR',
            status: 'captured',
            method: 'upi'
          }
        }
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyRazorpaySignature(rawBody, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_razorpay_signature(raw_body, signature, secret):
    generated = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(generated, signature)`,
    faqs: [
      {
        q: 'What is Razorpay webhook retry policy on failed HTTP status codes?',
        a: 'Razorpay retries failed webhooks (non-200 responses) periodically with exponential backoff over a 24-hour window.'
      }
    ]
  },
  'lemonsqueezy': {
    slug: 'lemonsqueezy',
    name: 'Lemon Squeezy',
    category: 'Payments',
    signatureHeader: 'X-Signature',
    signatureAlgorithm: 'HMAC-SHA256',
    tagline: 'Test Lemon Squeezy order created, subscription expired, and license key activated webhooks with instant signature check.',
    description: 'Inspect and debug Lemon Squeezy merchant-of-record webhooks. Verify \`X-Signature\` HMAC headers with sample payloads on safewebhook.com.',
    directAnswer: 'To test Lemon Squeezy webhooks, open Lemon Squeezy Dashboard > Settings > Webhooks, create a new webhook endpoint using your SafeWebhook URL, choose your events, and click Send Test Event.',
    keyTakeaways: [
      'Extract order.created, subscription.created, and license_key.created payloads.',
      'Instant HMAC-SHA256 verification of X-Signature headers.',
      'Zero-setup testing without configuring DNS or ngrok tunnels.',
      'Export payloads to Next.js or Laravel billing handlers with 1 click.'
    ],
    sampleEvents: [
      'order_created',
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled',
      'license_key_created'
    ],
    setupSteps: [
      'Navigate to Lemon Squeezy Dashboard > Settings > Webhooks.',
      'Click the "+" button to add a new webhook.',
      'Paste your SafeWebhook URL and supply a Signing Secret.',
      'Select events and click "Send test event".'
    ],
    samplePayload: {
      meta: {
        event_name: 'order_created',
        custom_data: { user_id: '12345' }
      },
      data: {
        id: '1',
        type: 'orders',
        attributes: {
          store_id: 11,
          customer_id: 1,
          identifier: 'ec892e39-1029-4928-8921-102938491029',
          order_number: 1,
          user_name: 'Jane Doe',
          user_email: 'jane@example.com',
          currency: 'USD',
          total: 2900,
          status: 'paid'
        }
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyLemonSqueezy(rawBody, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  return crypto.timingSafeEqual(digest, signatureBuffer);
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_lemon_squeezy(raw_body, signature, secret):
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)`,
    faqs: [
      {
        q: 'Does Lemon Squeezy include custom data in webhooks?',
        a: 'Yes, Lemon Squeezy attaches any custom metadata passed during checkout initialization inside \`meta.custom_data\`.'
      }
    ]
  },
  'square': {
    slug: 'square',
    name: 'Square',
    category: 'Payments',
    signatureHeader: 'X-Square-HMAC-SHA256-Signature',
    signatureAlgorithm: 'HMAC-SHA256 (Notification URL + Body Scheme)',
    tagline: 'Test Square payment, order, and customer inventory webhooks with full HMAC verification.',
    description: 'Capture Square POS and online payment webhooks in real-time. Verify Square multi-component HMAC signatures on safewebhook.com.',
    directAnswer: 'To test Square webhooks, open Square Developer Dashboard > Webhooks > Subscriptions, add your SafeWebhook URL, and trigger test events in the Square Sandbox.',
    keyTakeaways: [
      'Square signature requires hashing notification URL + raw body.',
      'Inspect payment.updated, order.created, and inventory.count.updated.',
      'Sub-20ms edge capture and inspection.',
      'Replay Square POS payloads directly to localhost.'
    ],
    sampleEvents: [
      'payment.created',
      'payment.updated',
      'order.created',
      'order.fulfillment.updated',
      'customer.created'
    ],
    setupSteps: [
      'In Square Developer Dashboard, select your application.',
      'Click Webhooks in the left sidebar and click "Add subscription".',
      'Enter your SafeWebhook URL and select Sandbox/Production events.',
      'Click "Save" and click "Send test event".'
    ],
    samplePayload: {
      merchant_id: 'ML2938491029',
      type: 'payment.updated',
      event_id: '89102938-1029-4829-1029-102938491029',
      created_at: '2026-08-19T12:00:00Z',
      data: {
        type: 'payment',
        id: 'pay_9812491029',
        object: {
          payment: {
            id: 'pay_9812491029',
            amount_money: { amount: 1500, currency: 'USD' },
            status: 'COMPLETED'
          }
        }
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifySquareSignature(webhookUrl, rawBody, signature, secretKey) {
  const combined = webhookUrl + rawBody;
  const hmac = crypto.createHmac('sha256', secretKey).update(combined).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}`,
    verificationCodePython: `import hmac
import hashlib
import base64

def verify_square_signature(webhook_url, raw_body, signature, secret_key):
    combined = webhook_url.encode('utf-8') + raw_body
    computed = base64.b64encode(hmac.new(secret_key.encode('utf-8'), combined, hashlib.sha256).digest()).decode('utf-8')
    return hmac.compare_digest(computed, signature)`,
    faqs: [
      {
        q: 'Why is Square webhook signature verification unique?',
        a: 'Square concatenates the exact Notification URL and the raw request body before applying HMAC-SHA256 and Base64 encoding.'
      }
    ]
  },
  'paypal': {
    slug: 'paypal',
    name: 'PayPal',
    category: 'Payments',
    signatureHeader: 'PAYPAL-TRANSMISSION-SIG',
    signatureAlgorithm: 'RSA-SHA256 with Cert Verification',
    tagline: 'Test PayPal IPN, checkout webhooks, dispute notifications, and verify transmission signatures without login.',
    description: 'Debug PayPal checkout events (PAYMENT.CAPTURE.COMPLETED, CHECKOUT.ORDER.APPROVED) and Instant Payment Notifications (IPN) on safewebhook.com.',
    directAnswer: 'To test PayPal webhooks, open PayPal Developer Dashboard > My Apps & Credentials > Webhooks, add your SafeWebhook endpoint, select event triggers, and test via the PayPal Webhook Simulator.',
    keyTakeaways: [
      'Capture PAYPAL-TRANSMISSION-ID, PAYPAL-CERT-URL, and PAYPAL-TRANSMISSION-SIG headers.',
      'Works with PayPal REST API webhooks and legacy IPN streams.',
      'Zero login or credit card required.',
      'Forward PayPal payments to localhost with 1-click Replay.'
    ],
    sampleEvents: [
      'PAYMENT.CAPTURE.COMPLETED',
      'PAYMENT.CAPTURE.DENIED',
      'CHECKOUT.ORDER.APPROVED',
      'CUSTOMER.DISPUTE.CREATED',
      'BILLING.SUBSCRIPTION.ACTIVATED'
    ],
    setupSteps: [
      'Log into PayPal Developer Dashboard > Apps & Credentials > Select your App.',
      'Scroll to Webhooks and click "Add Webhook".',
      'Paste your SafeWebhook URL from safewebhook.com.',
      'Select "All events" and click Save.'
    ],
    samplePayload: {
      id: 'WH-892189210-9120938',
      create_time: '2026-08-19T10:15:30Z',
      resource_type: 'capture',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      summary: 'Payment capture completed for $50.00 USD',
      resource: {
        id: '2GG394819028',
        amount: { currency_code: 'USD', value: '50.00' },
        status: 'COMPLETED'
      }
    },
    verificationCodeNode: `// Verify PayPal webhook using PayPal SDK or REST verification API
const fetch = require('node-fetch');

async function verifyPayPalWebhook(headers, body, webhookId, authHeader) {
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: body
    })
  });
  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}`,
    verificationCodePython: `import requests

def verify_paypal_webhook(headers, body, webhook_id, access_token):
    url = "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature"
    payload = {
        "auth_algo": headers.get("paypal-auth-algo"),
        "cert_url": headers.get("paypal-cert-url"),
        "transmission_id": headers.get("paypal-transmission-id"),
        "transmission_sig": headers.get("paypal-transmission-sig"),
        "transmission_time": headers.get("paypal-transmission-time"),
        "webhook_id": webhook_id,
        "webhook_event": body
    }
    res = requests.post(url, json=payload, headers={"Authorization": f"Bearer {access_token}"})
    return res.json().get("verification_status") == "SUCCESS"`,
    faqs: [
      {
        q: 'How do I test PayPal webhooks locally without public URLs?',
        a: 'Set SafeWebhook as your PayPal Webhook URL, then use the SafeWebhook Replay Drawer to forward events to your local server.'
      }
    ]
  },
  'supabase': {
    slug: 'supabase',
    name: 'Supabase',
    category: 'Authentication & Cloud',
    signatureHeader: 'X-Supabase-Event-Signature',
    signatureAlgorithm: 'Database Webhook Scheme',
    tagline: 'Test Supabase Database Webhooks, auth triggers, Edge Functions, and storage events live on SafeWebhook.',
    description: 'Inspect Supabase Postgres database changes (INSERT, UPDATE, DELETE) and Auth triggers on safewebhook.com with instant payload formatting.',
    directAnswer: 'To test Supabase database webhooks, open your Supabase Dashboard > Database > Webhooks, create a new webhook pointing to your SafeWebhook URL, and trigger an INSERT or UPDATE on your table.',
    keyTakeaways: [
      'Inspect old_record vs record Postgres row changes.',
      'Debug Supabase Auth hooks (user signup, token refresh).',
      'Test Edge Function invocations and HTTP status return codes.',
      'No account needed, 100% private in browser memory.'
    ],
    sampleEvents: [
      'INSERT',
      'UPDATE',
      'DELETE',
      'user.created',
      'storage.object.created'
    ],
    setupSteps: [
      'In Supabase Dashboard, go to Database > Webhooks.',
      'Click "Create a new webhook". Name your webhook and choose target table.',
      'Select Events (Insert, Update, Delete) and paste your SafeWebhook URL into HTTP Request URL.',
      'Insert a dummy row into your database table to view the event stream.'
    ],
    samplePayload: {
      type: 'INSERT',
      table: 'profiles',
      schema: 'public',
      record: {
        id: 'usr_89218491029',
        username: 'coder_dev',
        avatar_url: 'https://example.com/avatar.png',
        created_at: '2026-08-19T11:00:00Z'
      },
      old_record: null
    },
    verificationCodeNode: `// Supabase Database Webhook Handler
app.post('/supabase-webhook', (req, res) => {
  const { type, table, record, old_record } = req.body;
  console.log(\`Supabase \${type} on \${table}:\`, record);
  res.status(200).json({ processed: true });
});`,
    verificationCodePython: `from flask import Flask, request

@app.route('/supabase-webhook', methods=['POST'])
def supabase_event():
    data = request.json
    print(f"Postgres {data['type']} on table {data['table']}: {data['record']}")
    return {"status": "ok"}, 200`,
    faqs: [
      {
        q: 'Can I simulate slow responses to test Supabase Database Webhook retries?',
        a: 'Yes. Use SafeWebhook’s Simulated Latency slider to delay the 200 OK acknowledgment and verify how Supabase handles slow endpoints.'
      }
    ]
  },
  'clerk': {
    slug: 'clerk',
    name: 'Clerk',
    category: 'Authentication & Cloud',
    signatureHeader: 'svix-signature',
    signatureAlgorithm: 'Svix HMAC-SHA256 Webhook Standard',
    tagline: 'Test Clerk user authentication, session, organization, and passkey webhooks with Svix signature validation.',
    description: 'Inspect Clerk user.created, user.updated, session.created, and organization.created events on safewebhook.com in real-time.',
    directAnswer: 'To test Clerk webhooks, navigate to Clerk Dashboard > Webhooks > Add Endpoint, paste your SafeWebhook URL, select user events, and trigger a test registration in your Clerk app.',
    keyTakeaways: [
      'Built on the modern Svix webhook standard (svix-id, svix-timestamp, svix-signature).',
      'Inspect user metadata, OAuth identity providers, and email verification status.',
      'Replay user creation payloads directly to your database sync worker.',
      'Verify Svix HMAC-SHA256 signatures with 1-click recipes.'
    ],
    sampleEvents: [
      'user.created',
      'user.updated',
      'user.deleted',
      'session.created',
      'organization.created'
    ],
    setupSteps: [
      'In Clerk Dashboard, navigate to Configure > Webhooks.',
      'Click "Add Endpoint" and enter your SafeWebhook URL.',
      'Select events (e.g. user.created, session.created) and click Create.',
      'Click "Testing" tab in Clerk to send an immediate sample payload.'
    ],
    samplePayload: {
      data: {
        id: 'user_2N981029384',
        first_name: 'John',
        last_name: 'Doe',
        email_addresses: [
          { email_address: 'john@example.com', verification: { status: 'verified' } }
        ],
        created_at: 1755541200
      },
      object: 'event',
      type: 'user.created'
    },
    verificationCodeNode: `const { Webhook } = require('svix');

app.post('/clerk-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
  try {
    const payload = wh.verify(req.body, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature']
    });
    console.log('Verified Clerk User:', payload.data.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});`,
    verificationCodePython: `from svix.webhooks import Webhook

def verify_clerk(raw_body, headers, secret):
    wh = Webhook(secret)
    return wh.verify(raw_body, headers)`,
    faqs: [
      {
        q: 'How does Clerk sign webhook requests?',
        a: 'Clerk uses Svix webhook signing with svix-id, svix-timestamp, and svix-signature headers containing base64-encoded HMAC-SHA256 tokens.'
      }
    ]
  },
  'resend': {
    slug: 'resend',
    name: 'Resend',
    category: 'Messaging & Communications',
    signatureHeader: 'svix-signature',
    signatureAlgorithm: 'Svix HMAC-SHA256',
    tagline: 'Test Resend transactional email delivery, open tracking, click, and bounce webhooks with Svix signatures.',
    description: 'Inspect Resend email.sent, email.delivered, email.bounced, and email.complained webhooks on safewebhook.com with zero registration.',
    directAnswer: 'To test Resend webhooks, open Resend Dashboard > Webhooks > Add Webhook, paste your SafeWebhook URL, select email events, and send a test email via the Resend API.',
    keyTakeaways: [
      'Debug email delivery states (sent, delivered, bounced, complained).',
      'Inspect bounce reason details and recipient email tracking headers.',
      'Svix signature verification recipes included.',
      'Fast edge streaming without server logs.'
    ],
    sampleEvents: [
      'email.sent',
      'email.delivered',
      'email.bounced',
      'email.clicked',
      'email.opened'
    ],
    setupSteps: [
      'Log into Resend Dashboard > Webhooks.',
      'Click "Add Webhook" and enter your SafeWebhook URL.',
      'Select events (email.sent, email.delivered, email.bounced) and save.',
      'Send a test transactional email via Resend API.'
    ],
    samplePayload: {
      type: 'email.delivered',
      created_at: '2026-08-19T10:00:00.000Z',
      data: {
        email_id: '49a39f8f-1827-4a0f-a651-1c10928a0192',
        from: 'Acme <onboarding@resend.dev>',
        to: ['customer@example.com'],
        subject: 'Welcome to Acme App',
        created_at: '2026-08-19T10:00:00.000Z'
      }
    },
    verificationCodeNode: `const { Webhook } = require('svix');

app.post('/resend-webhook', (req, res) => {
  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET);
  try {
    const event = wh.verify(req.body, req.headers);
    console.log('Resend Event:', event.type, event.data.email_id);
    res.status(200).send('OK');
  } catch (err) {
    res.status(400).send('Invalid signature');
  }
});`,
    verificationCodePython: `from svix.webhooks import Webhook

def verify_resend_webhook(body, headers, secret):
    return Webhook(secret).verify(body, headers)`,
    faqs: [
      {
        q: 'How do I test email bounce handling locally?',
        a: 'Send an email to Resend test bounce address (e.g. delivered@resend.dev, bounced@resend.dev) with your SafeWebhook URL configured, then replay the bounce payload to your local user database handler.'
      }
    ]
  },
  'slack': {
    slug: 'slack',
    name: 'Slack',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Slack-Signature',
    signatureAlgorithm: 'HMAC-SHA256 (v0 scheme)',
    tagline: 'Test Slack App Event Subscriptions, Slash Commands, Interactivity payloads, and verify X-Slack-Signature.',
    description: 'Debug Slack bot events (message.channels, app_mention) and URL verification handshakes (ssl_check, url_verification) on SafeWebhook.',
    directAnswer: 'To test Slack webhooks, go to Slack API Apps > Event Subscriptions, enable events, paste your SafeWebhook URL into Request URL, and complete the url_verification challenge response.',
    keyTakeaways: [
      'Handles Slack url_verification challenge handshake.',
      'Live validation of X-Slack-Request-Timestamp and X-Slack-Signature.',
      'Inspect Slash Commands and Interactive Modal block actions.',
      'Replay Slack mentions to localhost:3000.'
    ],
    sampleEvents: [
      'url_verification',
      'app_mention',
      'message.channels',
      'slash_commands',
      'block_actions'
    ],
    setupSteps: [
      'In Slack API Portal > Your App > Event Subscriptions > Turn On.',
      'Paste your SafeWebhook URL into "Request URL".',
      'SafeWebhook will acknowledge the challenge token.',
      'Subscribe to bot events (e.g. app_mention) and save changes.'
    ],
    samplePayload: {
      token: 'J8219082390812',
      challenge: '3eZbrw1aBm2rZgRNFDxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P',
      type: 'url_verification'
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifySlackSignature(rawBody, timestamp, signature, signingSecret) {
  const sigBasestring = 'v0:' + timestamp + ':' + rawBody;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(signature, 'utf8'));
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_slack_signature(raw_body, timestamp, signature, secret):
    basestring = f"v0:{timestamp}:{raw_body.decode('utf-8')}".encode('utf-8')
    computed = "v0=" + hmac.new(secret.encode('utf-8'), basestring, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)`,
    faqs: [
      {
        q: 'Why does Slack require timestamp checking?',
        a: 'Slack includes \`X-Slack-Request-Timestamp\` to protect against replay attacks. You should reject requests older than 5 minutes.'
      }
    ]
  },
  'twilio': {
    slug: 'twilio',
    name: 'Twilio',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Twilio-Signature',
    signatureAlgorithm: 'HMAC-SHA1 (Sorted Form Parameters)',
    tagline: 'Test Twilio SMS, Voice status callbacks, WhatsApp messaging, and verify X-Twilio-Signature headers.',
    description: 'Inspect Twilio incoming SMS, call status callbacks, and delivery receipts in real time on safewebhook.com.',
    directAnswer: 'To test Twilio webhooks, open Twilio Console > Phone Numbers > Manage > Active Numbers, paste your SafeWebhook URL into "A message comes in", and send a text to your Twilio number.',
    keyTakeaways: [
      'Inspect application/x-www-form-urlencoded Twilio payloads.',
      'Verify X-Twilio-Signature with auth tokens.',
      'Test TwiML response simulator (XML).',
      'Instant logging without public tunneling CLI.'
    ],
    sampleEvents: [
      'incoming_sms',
      'sms_delivered',
      'voice_call_initiated',
      'voice_call_completed',
      'recording_ready'
    ],
    setupSteps: [
      'Go to Twilio Console > Phone Numbers > Manage > Active Numbers.',
      'Click your Twilio number, scroll to Messaging section.',
      'In "A MESSAGE COMES IN", select Webhook and paste your SafeWebhook URL.',
      'Click Save and send a test SMS to the number.'
    ],
    samplePayload: {
      ToCountry: 'US',
      ToState: 'CA',
      SmsMessageSid: 'SM89218491029',
      NumMedia: '0',
      To: '+15550001111',
      From: '+15552223333',
      Body: 'Testing Twilio with SafeWebhook',
      FromCountry: 'US'
    },
    verificationCodeNode: `const twilio = require('twilio');

function verifyTwilioWebhook(req, url, authToken) {
  const twilioSignature = req.headers['x-twilio-signature'];
  const params = req.body;
  return twilio.validateRequest(authToken, twilioSignature, url, params);
}`,
    verificationCodePython: `from twilio.request_validator import RequestValidator

def verify_twilio(url, params, signature, auth_token):
    validator = RequestValidator(auth_token)
    return validator.validate(url, params, signature)`,
    faqs: [
      {
        q: 'What format does Twilio use for webhook data?',
        a: 'Twilio uses URL-encoded form data (POST application/x-www-form-urlencoded) rather than JSON.'
      }
    ]
  },
  'discord': {
    slug: 'discord',
    name: 'Discord',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Signature-Ed25519',
    signatureAlgorithm: 'Ed25519 Cryptographic Signatures',
    tagline: 'Test Discord Interactions, Slash Commands, Bot webhooks, and verify Ed25519 public key signatures.',
    description: 'Inspect Discord bot slash command interactions and component callbacks on safewebhook.com with automatic Ed25519 cryptographic validation.',
    directAnswer: 'To test Discord Interactions, configure your SafeWebhook URL under Discord Developer Portal > Applications > General Information > Interactions Endpoint URL. Complete the PING / PONG handshake to start inspecting bot commands.',
    keyTakeaways: [
      'Handles Discord Type 1 PING handshake response.',
      'Ed25519 public key verification code recipes.',
      'Inspect Discord modal submissions and button clicks.',
      'Zero installation, edge streaming.'
    ],
    sampleEvents: [
      'PING (Type 1)',
      'APPLICATION_COMMAND (Type 2)',
      'MESSAGE_COMPONENT (Type 3)',
      'MODAL_SUBMIT (Type 5)'
    ],
    setupSteps: [
      'Go to Discord Developer Portal > Applications > Your App.',
      'In General Information, locate "Interactions Endpoint URL".',
      'Paste your SafeWebhook URL and click Save Changes.',
      'Trigger a slash command from your Discord server.'
    ],
    samplePayload: {
      type: 2,
      id: '89102938491029384',
      application_id: '78910293849102938',
      data: {
        id: '89102938491029',
        name: 'ping',
        type: 1
      },
      user: {
        id: '123456789',
        username: 'gamer_dev',
        discriminator: '0001'
      }
    },
    verificationCodeNode: `const nacl = require('tweetnacl');

function verifyDiscordInteraction(rawBody, signature, timestamp, clientPublicKey) {
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(clientPublicKey, 'hex')
  );
}`,
    verificationCodePython: `from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

def verify_discord_interaction(raw_body, signature, timestamp, public_key):
    verify_key = VerifyKey(bytes.fromhex(public_key))
    try:
        verify_key.verify(f'{timestamp}{raw_body.decode("utf-8")}'.encode(), bytes.fromhex(signature))
        return True
    except BadSignatureError:
        return False`,
    faqs: [
      {
        q: 'Why does Discord use Ed25519 instead of HMAC-SHA256?',
        a: 'Ed25519 provides asymmetric public-key cryptography, allowing receivers to verify Discord origins using Discord’s public key without sharing a secret.'
      }
    ]
  },
  'svix': {
    slug: 'svix',
    name: 'Svix',
    category: 'Developer Tools',
    signatureHeader: 'svix-signature',
    signatureAlgorithm: 'Svix HMAC-SHA256 Webhook Standard',
    tagline: 'Test Svix enterprise webhooks, automated retries, and verify svix-id, svix-timestamp, and svix-signature.',
    description: 'Debug Svix enterprise webhook payloads with instant signature verification and payload diffing on safewebhook.com.',
    directAnswer: 'To test Svix webhooks, add your SafeWebhook URL as an endpoint in your Svix Dashboard or via the Svix SDK. You can send test events and verify Svix signatures immediately.',
    keyTakeaways: [
      'Svix standard is used by Clerk, Resend, Brex, and thousands of platforms.',
      'Extracts timestamp, message ID, and v1 signature.',
      '1-Click code generation for Node, Python, Rust, and Go.',
      'Replay Svix events to localhost.'
    ],
    sampleEvents: [
      'invoice.paid',
      'user.created',
      'subscription.renewed',
      'device.connected'
    ],
    setupSteps: [
      'Open Svix Dashboard > Endpoints > Add Endpoint.',
      'Paste your SafeWebhook URL into Endpoint URL.',
      'Select event types and click Create.',
      'Click "Send Example Event" to verify delivery.'
    ],
    samplePayload: {
      type: 'invoice.paid',
      data: {
        id: 'inv_98218491029',
        amount: 9900,
        currency: 'USD',
        customer: 'cus_89102938'
      }
    },
    verificationCodeNode: `const { Webhook } = require('svix');

const wh = new Webhook(process.env.SVIX_SECRET);
const payload = wh.verify(req.body, req.headers);`,
    verificationCodePython: `from svix.webhooks import Webhook

wh = Webhook(secret)
payload = wh.verify(raw_body, headers)`,
    faqs: [
      {
        q: 'What makes Svix webhook verification resilient against replay attacks?',
        a: 'Svix packages the message ID and timestamp into the signed hash and rejects events outside a 5-minute clock drift window.'
      }
    ]
  },
  'sendgrid': {
    slug: 'sendgrid',
    name: 'SendGrid',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Twilio-Email-Event-Webhook-Signature',
    signatureAlgorithm: 'ECDSA (SHA256 with curve secp256r1)',
    tagline: 'Test SendGrid Event Webhook delivery, clicks, opens, spam reports, and verify ECDSA signatures.',
    description: 'Inspect SendGrid email activity events (delivered, open, click, bounce, dropped) live on safewebhook.com with zero setup.',
    directAnswer: 'To test SendGrid webhooks, go to SendGrid Settings > Mail Settings > Event Webhook, paste your SafeWebhook URL, configure event notifications, and click Test Your Integration.',
    keyTakeaways: [
      'Inspect batch email event arrays.',
      'Verify SendGrid ECDSA public key signature.',
      'Debug dropped and bounced email notifications.',
      'Sub-20ms edge capture.'
    ],
    sampleEvents: [
      'delivered',
      'open',
      'click',
      'bounce',
      'dropped',
      'spamreport'
    ],
    setupSteps: [
      'Go to SendGrid > Settings > Mail Settings > Event Webhook.',
      'Paste your SafeWebhook URL into the "HTTP POST URL" field.',
      'Select Deliverability data and Engagement data checkboxes.',
      'Click "Test Your Integration" to dispatch a sample array.'
    ],
    samplePayload: [
      {
        email: 'user@example.com',
        timestamp: 1755541200,
        event: 'delivered',
        sg_event_id: 'sg_evt_892184910',
        sg_message_id: 'msg_982184910.filter0001.2938491029',
        response: '250 2.0.0 OK 1755541200 d20si9283401pla.120'
      }
    ],
    verificationCodeNode: `const { EventWebhook, EventWebhookHeader } = require('@sendgrid/eventwebhook');

function verifySendGrid(rawBody, signature, timestamp, publicKey) {
  const ew = new EventWebhook();
  const key = ew.convertPublicKeyToECDSA(publicKey);
  return ew.verifySignature(key, rawBody, signature, timestamp);
}`,
    verificationCodePython: `from sendgrid.helpers.eventwebhook import EventWebhook

def verify_sendgrid(raw_body, signature, timestamp, public_key):
    ew = EventWebhook()
    key = ew.convert_public_key_to_ecdsa(public_key)
    return ew.verify_signature(raw_body, signature, timestamp, key)`,
    faqs: [
      {
        q: 'Why does SendGrid send an array of events instead of a single object?',
        a: 'SendGrid batches high-volume email events into JSON arrays to optimize throughput and reduce HTTP overhead.'
      }
    ]
  },
  'woocommerce': {
    slug: 'woocommerce',
    name: 'WooCommerce',
    category: 'E-Commerce',
    signatureHeader: 'X-WC-Webhook-Signature',
    signatureAlgorithm: 'HMAC-SHA256 (Base64-encoded)',
    tagline: 'Test WooCommerce order created, product updated, customer created webhooks with Base64 HMAC validation.',
    description: 'Inspect WordPress WooCommerce webhooks in real-time. Verify \`X-WC-Webhook-Signature\` headers on safewebhook.com.',
    directAnswer: 'To test WooCommerce webhooks, open WordPress Admin > WooCommerce > Settings > Advanced > Webhooks, create a webhook with your SafeWebhook URL, and trigger an order.',
    keyTakeaways: [
      'Inspect WooCommerce order line items, billing, and shipping details.',
      'Verify X-WC-Webhook-Signature Base64 HMAC-SHA256.',
      'Test order.created, order.updated, product.created.',
      'Replay store orders to localhost.'
    ],
    sampleEvents: [
      'woocommerce_webhook_ping',
      'order.created',
      'order.updated',
      'order.deleted',
      'product.created'
    ],
    setupSteps: [
      'In WordPress Admin, go to WooCommerce > Settings > Advanced > Webhooks.',
      'Click "Add webhook". Name: SafeWebhook, Status: Active, Topic: Order created.',
      'Paste your SafeWebhook URL into Delivery URL and provide a Secret.',
      'Click "Save webhook".'
    ],
    samplePayload: {
      id: 7291,
      parent_id: 0,
      status: 'processing',
      currency: 'USD',
      total: '89.99',
      billing: { first_name: 'Alex', last_name: 'Smith', email: 'alex@example.com' }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyWooCommerce(rawBody, signature, secret) {
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}`,
    verificationCodePython: `import hmac
import hashlib
import base64

def verify_woocommerce(raw_body, signature, secret):
    digest = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).digest()
    computed = base64.b64encode(digest).decode('utf-8')
    return hmac.compare_digest(computed, signature)`,
    faqs: [
      {
        q: 'What is the WooCommerce webhook signature format?',
        a: 'WooCommerce generates a Base64-encoded HMAC-SHA256 digest of the raw request payload using the secret configured in WooCommerce Settings.'
      }
    ]
  },
  'paddle': {
    slug: 'paddle',
    name: 'Paddle',
    category: 'Payments',
    signatureHeader: 'Paddle-Signature',
    signatureAlgorithm: 'HMAC-SHA256 (ts=...;h1=... scheme)',
    tagline: 'Test Paddle Billing webhooks, subscription lifecycle, transaction completed events, and verify Paddle signatures.',
    description: 'Debug Paddle Billing (v2) events (transaction.completed, subscription.created, customer.created) on safewebhook.com with instant signature check.',
    directAnswer: 'To test Paddle webhooks, navigate to Paddle Dashboard > Developer Tools > Notifications > New destination, paste your SafeWebhook URL, and trigger a simulated transaction.',
    keyTakeaways: [
      'Supports Paddle Billing v2 signature scheme (ts=...;h1=...).',
      'Inspect subscription pause, resume, and cancellation events.',
      'Zero signup required, live streaming on Cloudflare Edge.',
      'Replay Paddle subscriptions to localhost.'
    ],
    sampleEvents: [
      'transaction.completed',
      'transaction.billed',
      'subscription.created',
      'subscription.activated',
      'subscription.canceled'
    ],
    setupSteps: [
      'Go to Paddle Dashboard > Developer Tools > Notifications > Destinations.',
      'Click "New destination" and paste your SafeWebhook URL.',
      'Select events (e.g. transaction.completed, subscription.created).',
      'Click "Save destination" and click "Send test notification".'
    ],
    samplePayload: {
      event_id: 'evt_01h8921849102938',
      event_type: 'transaction.completed',
      occurred_at: '2026-08-19T11:00:00.000000Z',
      data: {
        id: 'txn_01h892184910',
        status: 'completed',
        customer_id: 'ctm_01h89218',
        currency_code: 'USD',
        details: { totals: { total: '4900' } }
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyPaddleSignature(rawBody, signatureHeader, secretKey) {
  const parts = signatureHeader.split(';');
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
  const h1 = parts.find(p => p.startsWith('h1='))?.split('=')[1];
  if (!ts || !h1) return false;
  
  const signedPayload = \`\${ts}:\${rawBody}\`;
  const computed = crypto.createHmac('sha256', secretKey).update(signedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(h1));
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_paddle(raw_body, signature_header, secret):
    parts = dict(item.split('=') for item in signature_header.split(';'))
    ts, h1 = parts.get('ts'), parts.get('h1')
    if not ts or not h1:
        return False
    signed_payload = f"{ts}:{raw_body.decode('utf-8')}".encode('utf-8')
    computed = hmac.new(secret.encode('utf-8'), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, h1)`,
    faqs: [
      {
        q: 'How does Paddle Billing v2 signature differ from Classic Paddle?',
        a: 'Paddle Billing v2 uses a modern timestamped HMAC-SHA256 scheme (\`ts=...;h1=...\`) similar to Stripe, replacing the legacy RSA public key verification.'
      }
    ]
  },
  'mailgun': {
    slug: 'mailgun',
    name: 'Mailgun',
    category: 'Messaging & Communications',
    signatureHeader: 'signature.signature (JSON payload)',
    signatureAlgorithm: 'HMAC-SHA256 (timestamp + token)',
    tagline: 'Test Mailgun email delivered, opened, clicked, bounced, and dropped webhooks with instant signature verification.',
    description: 'Inspect Mailgun transactional email webhook payloads and verify \`signature.signature\` HMAC-SHA256 in real-time on safewebhook.com.',
    directAnswer: 'To test Mailgun webhooks, navigate to Mailgun Dashboard > Sending > Webhooks, select your domain, add your SafeWebhook URL for event types, and click Test Webhook.',
    keyTakeaways: [
      'Mailgun puts signature object inside the JSON body.',
      'Inspect email delivery events, spam complaints, and temporary drop errors.',
      'Instant verification recipes in Node and Python.',
      'Zero storage ensures customer email contents remain private.'
    ],
    sampleEvents: [
      'delivered',
      'opened',
      'clicked',
      'failed',
      'unsubscribed',
      'complained'
    ],
    setupSteps: [
      'Open Mailgun Dashboard > Sending > Webhooks.',
      'Select your sending domain and click "Add Webhook".',
      'Paste your SafeWebhook URL and select the event type (e.g. Delivered Messages).',
      'Click "Test Webhook" to send a sample payload.'
    ],
    samplePayload: {
      signature: {
        timestamp: '1755541200',
        token: 'd8921849102938491029384910293849',
        signature: '9821849102938491029384910293849102938491029384910293849102938491'
      },
      'event-data': {
        event: 'delivered',
        id: 'EVT89218491029',
        timestamp: 1755541200,
        message: {
          headers: {
            to: 'recipient@example.com',
            from: 'noreply@yourdomain.com',
            subject: 'Account Activation'
          }
        },
        recipient: 'recipient@example.com'
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyMailgunSignature(token, timestamp, signature, signingKey) {
  const value = timestamp + token;
  const hash = crypto.createHmac('sha256', signingKey).update(value).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_mailgun(token, timestamp, signature, signing_key):
    encoded = f"{timestamp}{token}".encode('utf-8')
    computed = hmac.new(signing_key.encode('utf-8'), encoded, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)`,
    faqs: [
      {
        q: 'Where does Mailgun transmit the signature for verification?',
        a: 'Unlike providers that use HTTP headers, Mailgun embeds the signature metadata (\`timestamp\`, \`token\`, \`signature\`) directly inside the JSON request body.'
      }
    ]
  },
  'hubspot': {
    slug: 'hubspot',
    name: 'HubSpot',
    category: 'Productivity & CRM',
    signatureHeader: 'X-HubSpot-Signature-v3',
    signatureAlgorithm: 'HMAC-SHA256 (Method + URI + Body + Timestamp Scheme)',
    tagline: 'Test HubSpot CRM contact created, deal updated, and workflow action webhooks with v3 signature check.',
    description: 'Inspect HubSpot CRM workflow extensions, custom app webhooks, and contact updates on safewebhook.com with zero configuration.',
    directAnswer: 'To test HubSpot webhooks, open HubSpot Developer Account > Apps > Webhooks, set your target URL to your SafeWebhook endpoint, subscribe to contact or deal events, and trigger an edit in your HubSpot CRM.',
    keyTakeaways: [
      'Validate complex HubSpot v3 signature schemes.',
      'Inspect contact.creation, deal.propertyChange, and company.associationChange.',
      'Test HubSpot workflow custom code action payloads.',
      'Forward CRM events to localhost development servers.'
    ],
    sampleEvents: [
      'contact.creation',
      'contact.propertyChange',
      'deal.creation',
      'deal.propertyChange',
      'company.creation'
    ],
    setupSteps: [
      'In HubSpot Developer Account, open your App settings.',
      'Click "Webhooks" in the sidebar and enter your SafeWebhook URL into "Target URL".',
      'Click "Create subscription" and select event types (e.g. contact.creation).',
      'Create a test contact in HubSpot CRM to trigger an event.'
    ],
    samplePayload: [
      {
        eventId: 100,
        subscriptionId: 2891029,
        portalId: 8921849,
        appId: 102938,
        occurredAt: 1755541200000,
        subscriptionType: 'contact.propertyChange',
        attemptNumber: 0,
        objectId: 12345,
        propertyName: 'email',
        propertyValue: 'lead@example.com',
        changeSource: 'CRM'
      }
    ],
    verificationCodeNode: `const crypto = require('crypto');

function verifyHubSpotV3(method, uri, rawBody, timestamp, signature, clientSecret) {
  const sourceString = method + uri + rawBody + timestamp;
  const hash = crypto.createHmac('sha256', clientSecret).update(sourceString).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}`,
    verificationCodePython: `import hmac
import hashlib
import base64

def verify_hubspot_v3(method, uri, raw_body, timestamp, signature, secret):
    source = f"{method}{uri}{raw_body.decode('utf-8')}{timestamp}".encode('utf-8')
    computed = base64.b64encode(hmac.new(secret.encode('utf-8'), source, hashlib.sha256).digest()).decode('utf-8')
    return hmac.compare_digest(computed, signature)`,
    faqs: [
      {
        q: 'What is included in the HubSpot v3 signature hash?',
        a: 'HubSpot v3 signatures concatenate HTTP Method + Request URI + Request Body + Timestamp header before HMAC-SHA256 hashing.'
      }
    ]
  },
  'linear': {
    slug: 'linear',
    name: 'Linear',
    category: 'Productivity & CRM',
    signatureHeader: 'Linear-Signature',
    signatureAlgorithm: 'HMAC-SHA256',
    tagline: 'Test Linear issue created, cycle completed, and comment added webhooks with HMAC validation.',
    description: 'Inspect Linear engineering workflow webhooks, project updates, and label changes on safewebhook.com with instant formatting.',
    directAnswer: 'To test Linear webhooks, go to Linear Workspace Settings > API > Webhooks > New Webhook, paste your SafeWebhook URL, and create or update an issue in Linear.',
    keyTakeaways: [
      'Inspect Issue, Comment, Project, and Cycle webhook models.',
      'Verify Linear-Signature HMAC-SHA256 headers.',
      'Replay issue events directly to your local GitHub sync service.',
      'Fast edge inspection with zero account required.'
    ],
    sampleEvents: [
      'Issue.create',
      'Issue.update',
      'Issue.remove',
      'Comment.create',
      'Project.update'
    ],
    setupSteps: [
      'In Linear, navigate to Settings > Workspace > API > Webhooks.',
      'Click "New webhook" and enter your SafeWebhook URL.',
      'Select resources (Issues, Comments, Projects) and click Create.',
      'Create a new issue in Linear to stream the payload.'
    ],
    samplePayload: {
      action: 'create',
      type: 'Issue',
      createdAt: '2026-08-19T12:30:00.000Z',
      data: {
        id: 'iss_89218491029',
        title: 'Fix edge webhook latency bug',
        priority: 1,
        state: { name: 'In Progress', type: 'started' },
        team: { key: 'ENG', name: 'Engineering' }
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyLinearSignature(rawBody, signature, secret) {
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_linear(raw_body, signature, secret):
    computed = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)`,
    faqs: [
      {
        q: 'How do I test Linear issue sync workflows locally?',
        a: 'Configure SafeWebhook as your Linear webhook URL, then use the Replay Drawer to send payload copies to your local dev service running on localhost:3000.'
      }
    ]
  },
  'jira': {
    slug: 'jira',
    name: 'Jira (Atlassian)',
    category: 'Productivity & CRM',
    signatureHeader: 'X-Hub-Signature',
    signatureAlgorithm: 'Atlassian Connect Webhook Scheme',
    tagline: 'Test Atlassian Jira issue created, sprint closed, and worklog added webhooks live on SafeWebhook.',
    description: 'Debug Atlassian Jira Software and Jira Service Management webhooks with zero signup on safewebhook.com.',
    directAnswer: 'To test Jira webhooks, open Jira Settings > System > Webhooks, click Create a Webhook, enter your SafeWebhook URL, configure JQL filters, and click Save.',
    keyTakeaways: [
      'Inspect Jira issue changelog and custom field mappings.',
      'Filter events by JQL (e.g. project = ENG AND priority = High).',
      'Test sprint_started, issue_updated, and worklog_created.',
      'Zero server storage protects enterprise ticket data.'
    ],
    sampleEvents: [
      'jira:issue_created',
      'jira:issue_updated',
      'jira:issue_deleted',
      'sprint_started',
      'worklog_created'
    ],
    setupSteps: [
      'In Jira Admin, go to Settings > System > Webhooks (under Advanced).',
      'Click "Create a Webhook" button.',
      'Enter a Name and paste your SafeWebhook URL into the URL field.',
      'Select Issue related events and click Create.'
    ],
    samplePayload: {
      timestamp: 1755541200000,
      webhookEvent: 'jira:issue_updated',
      issue_event_type_name: 'issue_generic_event',
      user: { displayName: 'Dev Lead', accountId: 'acc_8921849' },
      issue: {
        id: '10042',
        key: 'PROJ-104',
        fields: {
          summary: 'Upgrade payment gateway webhook listeners',
          status: { name: 'Done' },
          priority: { name: 'High' }
        }
      },
      changelog: {
        items: [
          { field: 'status', fromString: 'In Progress', toString: 'Done' }
        ]
      }
    },
    verificationCodeNode: `// Jira Webhook Handler
app.post('/jira-webhook', (req, res) => {
  const { webhookEvent, issue, changelog } = req.body;
  console.log(\`Jira \${webhookEvent} for \${issue.key}: \${issue.fields.summary}\`);
  res.status(200).send('OK');
});`,
    verificationCodePython: `from flask import Flask, request

@app.route('/jira-webhook', methods=['POST'])
def jira_webhook():
    data = request.json
    print(f"Jira {data.get('webhookEvent')} for {data['issue']['key']}")
    return 'ok', 200`,
    faqs: [
      {
        q: 'Can I filter Jira webhooks by project or status?',
        a: 'Yes, Jira supports JQL (Jira Query Language) filtering directly in the webhook configuration screen before dispatching to SafeWebhook.'
      }
    ]
  }
};

export const PLATFORM_SLUGS = Object.keys(PLATFORMS);
