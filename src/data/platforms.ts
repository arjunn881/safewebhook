export interface PlatformIntegration {
  slug: string;
  name: string;
  category: 'Payments' | 'Developer Tools' | 'E-Commerce' | 'Messaging & Communications' | 'Authentication & Cloud';
  signatureHeader: string;
  signatureAlgorithm: string;
  tagline: string;
  description: string;
  sampleEvents: string[];
  setupSteps: string[];
  samplePayload: Record<string, unknown> | Array<unknown>;
  verificationCodeNode: string;
  verificationCodePython: string;
  faqs: Array<{ q: string; a: string }>;
}

export const PLATFORMS: Record<string, PlatformIntegration> = {
  'stripe': {
    slug: 'stripe',
    name: 'Stripe',
    category: 'Payments',
    signatureHeader: 'Stripe-Signature',
    signatureAlgorithm: 'HMAC-SHA256 (timestamped scheme)',
    tagline: 'Test Stripe payment webhooks, subscription lifecycle events, and verify signatures locally without login on SafeWebhook.',
    description: 'Debug and inspect inbound Stripe webhooks in real-time. Verify `customer.subscription.created`, `payment_intent.succeeded`, and simulate charge failures with custom HTTP responses on safewebhook.com.',
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
        a: 'Paste your SafeWebhook endpoint into the Stripe Dashboard, and use our built-in Replay Drawer to forward incoming events straight to http://localhost:8000/webhook.'
      },
      {
        q: 'How does SafeWebhook verify Stripe-Signature headers?',
        a: 'SafeWebhook auto-detects the Stripe-Signature header, extracts the timestamp (t=...) and v1 signature hash, and displays ready-to-run verification recipes.'
      }
    ]
  },
  'github': {
    slug: 'github',
    name: 'GitHub',
    category: 'Developer Tools',
    signatureHeader: 'X-Hub-Signature-256',
    signatureAlgorithm: 'HMAC-SHA256',
    tagline: 'Test GitHub push, pull request, and release webhooks with instant HMAC-SHA256 verification on SafeWebhook.',
    description: 'Inspect GitHub repository webhooks in real-time. Verify `push`, `pull_request`, `issues`, and GitHub Actions workflow triggers with zero server storage on safewebhook.com.',
    sampleEvents: [
      'push',
      'pull_request.opened',
      'pull_request.closed',
      'issues.opened',
      'workflow_run.completed'
    ],
    setupSteps: [
      'Go to your GitHub Repository > Settings > Webhooks > Add webhook.',
      'Set Payload URL to your SafeWebhook endpoint URL.',
      'Set Content type to `application/json` and enter an optional Secret.',
      'Select "Send me everything" or individual events, then click "Add webhook".'
    ],
    samplePayload: {
      ref: 'refs/heads/main',
      before: '6113728f27ae82c7b1a12f6d93da7f71e54575fb',
      after: '2c1a84f33190899ab47a83427be58b456241b712',
      repository: {
        id: 1296269,
        name: 'safewebhook',
        full_name: 'octocat/safewebhook',
        private: false
      },
      pusher: {
        name: 'octocat',
        email: 'octocat@github.com'
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyGitHubSignature(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_github_signature(payload_body, secret_token, signature_header):
    if not signature_header:
        return False
    hash_object = hmac.new(secret_token.encode('utf-8'), msg=payload_body, digestmod=hashlib.sha256)
    expected_signature = "sha256=" + hash_object.hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)`,
    faqs: [
      {
        q: 'What header does GitHub use for webhook signatures?',
        a: 'GitHub passes the HMAC-SHA256 signature in the X-Hub-Signature-256 header (prefixed with sha256=).'
      },
      {
        q: 'How do I test GitHub Organization webhooks?',
        a: 'In your GitHub Organization Settings > Webhooks, add your SafeWebhook endpoint URL to receive organization-wide member and repository events.'
      }
    ]
  },
  'shopify': {
    slug: 'shopify',
    name: 'Shopify',
    category: 'E-Commerce',
    signatureHeader: 'X-Shopify-Hmac-Sha256',
    signatureAlgorithm: 'HMAC-SHA256 (Base64-encoded)',
    tagline: 'Test Shopify orders, fulfillment, and customer webhooks with Base64 HMAC validation on SafeWebhook.',
    description: 'Debug Shopify store webhooks in real-time. Verify `orders/create`, `products/update`, and `app/uninstalled` webhooks with zero rate limits on safewebhook.com.',
    sampleEvents: [
      'orders/create',
      'orders/updated',
      'orders/paid',
      'products/create',
      'customers/create'
    ],
    setupSteps: [
      'In Shopify Admin, go to Settings > Notifications > Webhooks.',
      'Click "Create webhook", select your Event (e.g. Order creation).',
      'Paste your SafeWebhook endpoint into the URL field and select JSON format.',
      'Click Save to activate.'
    ],
    samplePayload: {
      id: 'gid://shopify/Order/820982911946154500',
      email: 'customer@example.com',
      created_at: '2026-08-19T01:45:00-04:00',
      total_price: '199.00',
      currency: 'USD',
      financial_status: 'paid',
      line_items: [
        {
          id: 'gid://shopify/LineItem/866550311764710765',
          title: 'Developer Pro Edition',
          price: '199.00',
          quantity: 1
        }
      ]
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyShopifyWebhook(rawBody, headerHmac, secret) {
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(headerHmac));
}`,
    verificationCodePython: `import hmac
import hashlib
import base64

def verify_shopify_signature(raw_body, secret, hmac_header):
    digest = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).digest()
    computed_hmac = base64.b64encode(digest).decode()
    return hmac.compare_digest(computed_hmac, hmac_header)`,
    faqs: [
      {
        q: 'How does Shopify encode webhook signatures?',
        a: 'Shopify encodes HMAC-SHA256 digests in Base64 format inside the X-Shopify-Hmac-Sha256 header.'
      },
      {
        q: 'What is the required webhook response time for Shopify?',
        a: 'Shopify expects a 200 OK response within 5 seconds; otherwise, it will retry the webhook and eventually disable the subscription.'
      }
    ]
  },
  'paypal': {
    slug: 'paypal',
    name: 'PayPal',
    category: 'Payments',
    signatureHeader: 'PAYPAL-TRANSMISSION-SIG',
    signatureAlgorithm: 'CRC32 + RSA-SHA256 with cert validation',
    tagline: 'Test PayPal webhook events, IPN callbacks, and dispute notifications on SafeWebhook.',
    description: 'Inspect PayPal Checkout, Subscription, and Dispute webhooks in real-time. Verify transmission signatures and simulate webhook success responses.',
    sampleEvents: [
      'PAYMENT.CAPTURE.COMPLETED',
      'BILLING.SUBSCRIPTION.CREATED',
      'CUSTOMER.DISPUTE.CREATED',
      'CHECKOUT.ORDER.APPROVED'
    ],
    setupSteps: [
      'In PayPal Developer Dashboard > My Apps & Credentials > Your App > Webhooks.',
      'Click "Add Webhook" and enter your SafeWebhook endpoint URL.',
      'Select event types (e.g. PAYMENT.CAPTURE.COMPLETED) and save.',
      'Use the PayPal Webhook Simulator to send mock events.'
    ],
    samplePayload: {
      id: 'WH-1234567890ABCDEF',
      event_version: '1.0',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource_type: 'capture',
      summary: 'Payment completed for $49.00 USD',
      resource: {
        id: 'CAP-9988776655',
        amount: { value: '49.00', currency_code: 'USD' },
        status: 'COMPLETED'
      }
    },
    verificationCodeNode: `// Verify PayPal Webhook via PayPal REST API
const paypal = require('@paypal/checkout-server-sdk');

async function verifyPayPalWebhook(req) {
  const verifyPayload = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: req.body
  };
  // Post verifyPayload to /v1/notifications/verify-webhook-signature
}`,
    verificationCodePython: `import requests

def verify_paypal_webhook(headers, payload, webhook_id, access_token):
    url = "https://api-m.paypal.com/v1/notifications/verify-webhook-signature"
    verify_body = {
        "auth_algo": headers.get("PAYPAL-AUTH-ALGO"),
        "cert_url": headers.get("PAYPAL-CERT-URL"),
        "transmission_id": headers.get("PAYPAL-TRANSMISSION-ID"),
        "transmission_sig": headers.get("PAYPAL-TRANSMISSION-SIG"),
        "transmission_time": headers.get("PAYPAL-TRANSMISSION-TIME"),
        "webhook_id": webhook_id,
        "webhook_event": payload
    }
    res = requests.post(url, json=verify_body, headers={"Authorization": f"Bearer {access_token}"})
    return res.json().get("verification_status") == "SUCCESS"`,
    faqs: [
      {
        q: 'How is PayPal webhook verification different from Stripe?',
        a: 'PayPal uses an asymmetric RSA certificate URL scheme where you verify the transmission signature by calling PayPal verify-webhook-signature API or validating against PayPal public X.509 cert.'
      }
    ]
  },
  'woocommerce': {
    slug: 'woocommerce',
    name: 'WooCommerce',
    category: 'E-Commerce',
    signatureHeader: 'X-WC-Webhook-Signature',
    signatureAlgorithm: 'HMAC-SHA256 (Base64-encoded)',
    tagline: 'Test WooCommerce order, customer, and subscription webhooks in real-time on SafeWebhook.',
    description: 'Inspect WordPress WooCommerce webhook deliveries with instant X-WC-Webhook-Signature HMAC-SHA256 validation.',
    sampleEvents: [
      'woocommerce_order_created',
      'woocommerce_order_updated',
      'woocommerce_customer_created',
      'woocommerce_subscription_status_changed'
    ],
    setupSteps: [
      'In WordPress Admin, go to WooCommerce > Settings > Advanced > Webhooks.',
      'Click "Add Webhook", set Status to Active, and choose Topic (e.g. Order created).',
      'Paste your SafeWebhook Delivery URL and set a shared Secret.',
      'Click "Save Webhook" and trigger an order.'
    ],
    samplePayload: {
      id: 9942,
      parent_id: 0,
      status: 'processing',
      currency: 'USD',
      total: '89.00',
      billing: {
        first_name: 'Jane',
        last_name: 'Developer',
        email: 'jane@example.com'
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyWooCommerceWebhook(rawBody, signature, secret) {
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}`,
    verificationCodePython: `import hmac
import hashlib
import base64

def verify_woocommerce_signature(raw_body, secret, signature):
    digest = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature)`,
    faqs: [
      {
        q: 'What secret should I use for WooCommerce signature verification?',
        a: 'Use the Secret string you entered into the WooCommerce Webhook Settings modal in WP Admin.'
      }
    ]
  },
  'paddle': {
    slug: 'paddle',
    name: 'Paddle',
    category: 'Payments',
    signatureHeader: 'Paddle-Signature',
    signatureAlgorithm: 'HMAC-SHA256 with timestamp verification',
    tagline: 'Test Paddle Billing (v2) & Classic payment webhooks and subscription updates on SafeWebhook.',
    description: 'Debug Paddle Billing webhook notifications (`transaction.completed`, `subscription.created`) with automatic Paddle-Signature verification.',
    sampleEvents: [
      'transaction.completed',
      'subscription.created',
      'subscription.canceled',
      'adjustment.created'
    ],
    setupSteps: [
      'In Paddle Dashboard > Developer Tools > Notifications > Webhooks.',
      'Click "Add destination" and enter your SafeWebhook URL.',
      'Select events to subscribe to and save.',
      'Copy the Notification Secret for signature verification.'
    ],
    samplePayload: {
      event_id: 'evt_01h8q7k9v1b2',
      event_type: 'transaction.completed',
      occurred_at: '2026-08-19T01:55:00Z',
      data: {
        id: 'txn_01h8q7k9v1a1',
        status: 'completed',
        customer_id: 'ctm_01h8q7k9v1c3',
        details: { totals: { total: '9900', currency_code: 'USD' } }
      }
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifyPaddleSignature(rawBody, signatureHeader, secretKey) {
  // Paddle-Signature format: ts=1690000000;h1=hash
  const parts = signatureHeader.split(';').reduce((acc, curr) => {
    const [k, v] = curr.split('=');
    acc[k] = v;
    return acc;
  }, {});
  const payloadToSign = parts.ts + ':' + rawBody;
  const hash = crypto.createHmac('sha256', secretKey).update(payloadToSign).digest('hex');
  return hash === parts.h1;
}`,
    verificationCodePython: `import hmac
import hashlib

def verify_paddle_signature(raw_body, signature_header, secret_key):
    parts = dict(item.split("=") for item in signature_header.split(";"))
    ts = parts.get("ts")
    h1 = parts.get("h1")
    signed_payload = f"{ts}:{raw_body.decode('utf-8')}".encode('utf-8')
    computed_hash = hmac.new(secret_key.encode('utf-8'), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hash, h1)`,
    faqs: [
      {
        q: 'Does Paddle v2 use public keys or secret keys?',
        a: 'Paddle Billing v2 uses symmetric HMAC-SHA256 secret keys formatted in the Paddle-Signature header (ts=...;h1=...).'
      }
    ]
  },
  'supabase': {
    slug: 'supabase',
    name: 'Supabase',
    category: 'Authentication & Cloud',
    signatureHeader: 'X-Supabase-Event-Signature',
    signatureAlgorithm: 'Shared Token or HMAC-SHA256',
    tagline: 'Test Supabase Database Webhooks, Auth hooks, and Edge Function events on SafeWebhook.',
    description: 'Inspect Supabase Database Webhooks (INSERT, UPDATE, DELETE triggers on Postgres tables) with live payload formatting.',
    sampleEvents: [
      'INSERT',
      'UPDATE',
      'DELETE',
      'auth.user_created'
    ],
    setupSteps: [
      'In Supabase Dashboard > Database > Webhooks.',
      'Click "Create a new webhook", select your table and events (INSERT, UPDATE, DELETE).',
      'Set Webhook Type to HTTP Request and paste your SafeWebhook endpoint.',
      'Save and insert a row in Postgres Table Editor.'
    ],
    samplePayload: {
      type: 'INSERT',
      table: 'users',
      schema: 'public',
      record: {
        id: 'usr_88776655',
        email: 'developer@example.com',
        created_at: '2026-08-19T01:50:00.000Z'
      },
      old_record: null
    },
    verificationCodeNode: `app.post('/supabase-webhook', (req, res) => {
  const secretHeader = req.headers['authorization'];
  if (secretHeader !== \`Bearer \${process.env.SUPABASE_WEBHOOK_SECRET}\`) {
    return res.status(401).send('Unauthorized');
  }
  const { type, table, record } = req.body;
  console.log(\`Received \${type} on table \${table}\`, record);
  res.json({ success: true });
});`,
    verificationCodePython: `from flask import Flask, request, jsonify

@app.route('/supabase-webhook', methods=['POST'])
def supabase_hook():
    auth_header = request.headers.get('Authorization')
    if auth_header != f"Bearer {SUPABASE_SECRET}":
        return jsonify({'error': 'unauthorized'}), 401
    data = request.json
    print(f"Supabase event: {data['type']} on {data['table']}")
    return jsonify({'received': True}), 200`,
    faqs: [
      {
        q: 'How do I authenticate Supabase database webhooks?',
        a: 'When configuring the webhook in Supabase, add a custom HTTP Header: Authorization: Bearer YOUR_SECRET_KEY.'
      }
    ]
  },
  'clerk': {
    slug: 'clerk',
    name: 'Clerk',
    category: 'Authentication & Cloud',
    signatureHeader: 'svix-signature',
    signatureAlgorithm: 'Svix HMAC-SHA256 (svix-id, svix-timestamp, svix-signature)',
    tagline: 'Test Clerk user authentication webhooks (user.created, session.created) on SafeWebhook.',
    description: 'Debug Clerk authentication events (`user.created`, `session.ended`, `organization.created`) with standard Svix signature verification.',
    sampleEvents: [
      'user.created',
      'user.updated',
      'user.deleted',
      'session.created'
    ],
    setupSteps: [
      'In Clerk Dashboard > Configure > Webhooks > Add Endpoint.',
      'Paste your SafeWebhook endpoint URL.',
      'Subscribe to user.created and session.created events and save.',
      'Copy the Signing Secret for verification.'
    ],
    samplePayload: {
      data: {
        id: 'user_2NNEqL2K0v5j',
        first_name: 'Alex',
        last_name: 'Developer',
        email_addresses: [{ email_address: 'alex@example.com' }]
      },
      object: 'event',
      type: 'user.created'
    },
    verificationCodeNode: `const { Webhook } = require('svix');

app.post('/clerk-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
  try {
    const payload = wh.verify(req.body, req.headers);
    console.log('Clerk event verified:', payload.type);
    res.json({ success: true });
  } catch (err) {
    res.status(400).send('Invalid signature');
  }
});`,
    verificationCodePython: `from svix.webhooks import Webhook

wh = Webhook("whsec_...")
try:
    event = wh.verify(payload_bytes, headers_dict)
except Exception:
    return "Invalid signature", 400`,
    faqs: [
      {
        q: 'Why does Clerk use Svix headers?',
        a: 'Clerk uses Svix for reliable enterprise webhook delivery, sending svix-id, svix-timestamp, and svix-signature headers.'
      }
    ]
  },
  'resend': {
    slug: 'resend',
    name: 'Resend',
    category: 'Messaging & Communications',
    signatureHeader: 'svix-signature',
    signatureAlgorithm: 'Svix HMAC-SHA256',
    tagline: 'Test Resend transactional email webhooks (email.delivered, email.bounced) on SafeWebhook.',
    description: 'Inspect Resend transactional email delivery webhooks (`email.sent`, `email.delivered`, `email.bounced`, `email.clicked`) with zero retention.',
    sampleEvents: [
      'email.sent',
      'email.delivered',
      'email.bounced',
      'email.clicked',
      'email.complained'
    ],
    setupSteps: [
      'In Resend Dashboard > Webhooks > Add Webhook.',
      'Paste your SafeWebhook endpoint URL.',
      'Select events (email.delivered, email.bounced) and save.'
    ],
    samplePayload: {
      type: 'email.delivered',
      created_at: '2026-08-19T01:50:00.000Z',
      data: {
        email_id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794',
        from: 'team@resend.com',
        to: ['developer@example.com'],
        subject: 'Your Magic Login Link'
      }
    },
    verificationCodeNode: `const { Webhook } = require('svix');

app.post('/resend-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET);
  const evt = wh.verify(req.body, req.headers);
  console.log('Resend event:', evt.type);
  res.json({ received: true });
});`,
    verificationCodePython: `from svix.webhooks import Webhook
wh = Webhook(RESEND_WEBHOOK_SECRET)
payload = wh.verify(raw_body, headers)`,
    faqs: [
      {
        q: 'Does Resend support Svix webhook verification?',
        a: 'Yes. Resend uses standard Svix webhooks, allowing you to use the official @svix/webhooks SDK in Node, Python, and Go.'
      }
    ]
  },
  'slack': {
    slug: 'slack',
    name: 'Slack',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Slack-Signature',
    signatureAlgorithm: 'HMAC-SHA256 with timestamp verification',
    tagline: 'Test Slack slash commands, interactive block actions, and event subscriptions on SafeWebhook.',
    description: 'Inspect Slack app webhooks, interactive buttons, modal submissions, and Bot events in real-time with sub-20ms latency.',
    sampleEvents: [
      'block_actions',
      'slash_commands',
      'view_submission',
      'app_mention',
      'message.channels'
    ],
    setupSteps: [
      'Open api.slack.com > Your Apps > Interactivity & Shortcuts.',
      'Toggle Interactivity ON and paste your SafeWebhook Request URL.',
      'In Event Subscriptions, enable Events and paste your URL for Challenge verification.',
      'Save changes and trigger an action in your Slack workspace.'
    ],
    samplePayload: {
      type: 'block_actions',
      user: {
        id: 'U12345678',
        username: 'alex.developer',
        name: 'Alex'
      },
      api_app_id: 'A012345678',
      container: {
        type: 'message',
        message_ts: '1755541200.000100'
      },
      actions: [
        {
          action_id: 'approve_deploy_btn',
          block_id: 'deploy_actions_block',
          value: 'deploy_production_v2'
        }
      ]
    },
    verificationCodeNode: `const crypto = require('crypto');

function verifySlackSignature(rawBody, timestamp, signature, signingSecret) {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);
  if (timestamp < fiveMinutesAgo) return false;

  const sigBase = 'v0:' + timestamp + ':' + rawBody;
  const mySig = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBase).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySig), Buffer.from(signature));
}`,
    verificationCodePython: `import hmac
import hashlib
import time

def verify_slack_signature(raw_body, timestamp, signature, signing_secret):
    if abs(time.time() - int(timestamp)) > 60 * 5:
        return False
    sig_basestring = f"v0:{timestamp}:{raw_body.decode('utf-8')}".encode('utf-8')
    computed_sig = 'v0=' + hmac.new(signing_secret.encode('utf-8'), sig_basestring, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_sig, signature)`,
    faqs: [
      {
        q: 'How do I handle the Slack URL verification challenge?',
        a: 'Slack sends a POST request with {"type": "url_verification", "challenge": "xyz"}. In SafeWebhook, configure a Custom Response with statusCode: 200 and body: {"challenge": "xyz"} to verify instantly.'
      }
    ]
  },
  'twilio': {
    slug: 'twilio',
    name: 'Twilio',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Twilio-Signature',
    signatureAlgorithm: 'HMAC-SHA1 with sorted POST parameters',
    tagline: 'Test Twilio SMS inbound messages, voice call status callbacks, and WhatsApp webhooks on SafeWebhook.',
    description: 'Inspect Twilio SMS status callbacks, WhatsApp message webhooks, and Voice TwiML webhook calls in real-time.',
    sampleEvents: [
      'sms.received',
      'call.completed',
      'whatsapp.incoming',
      'message.delivered'
    ],
    setupSteps: [
      'In Twilio Console > Phone Numbers > Manage > Active Numbers.',
      'Click your active number and scroll to "A Message Comes In".',
      'Select Webhook and paste your SafeWebhook endpoint URL.',
      'Save configuration and send an SMS to your Twilio number.'
    ],
    samplePayload: {
      MessageSid: 'SM_EXAMPLE_MESSAGE_ID_000000',
      From: '+15551234567',
      To: '+15559876543',
      Body: 'Hello, this is a test SMS payload.',
      AccountSid: 'AC_EXAMPLE_ACCOUNT_SID_00000',
      NumMedia: '0'
    },
    verificationCodeNode: `const twilio = require('twilio');

app.post('/webhook', (req, res) => {
  const twilioSignature = req.headers['x-twilio-signature'];
  const url = 'https://safewebhook.com/webhook';
  const params = req.body;

  const isValid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, twilioSignature, url, params);
  if (isValid) {
    res.status(200).send('<Response></Response>');
  } else {
    res.status(403).send('Invalid signature');
  }
});`,
    verificationCodePython: `from twilio.request_validator import RequestValidator

validator = RequestValidator('YOUR_TWILIO_AUTH_TOKEN')
is_valid = validator.validate(
    'https://safewebhook.com/webhook',
    request.form,
    request.headers.get('X-Twilio-Signature', '')
)`,
    faqs: [
      {
        q: 'Does Twilio send JSON or Form-urlencoded data?',
        a: 'Twilio by default sends requests as application/x-www-form-urlencoded. SafeWebhook automatically parses both JSON and URL-encoded forms.'
      }
    ]
  },
  'discord': {
    slug: 'discord',
    name: 'Discord',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Signature-Ed25519',
    signatureAlgorithm: 'Ed25519 public key cryptographic signature',
    tagline: 'Test Discord bot interactions, slash commands, and incoming channel webhooks on SafeWebhook.',
    description: 'Inspect Discord application interactions and incoming channel webhooks in real-time with Ed25519 signature validation.',
    sampleEvents: [
      'PING (type 1)',
      'APPLICATION_COMMAND (type 2)',
      'MESSAGE_COMPONENT (type 3)',
      'MODAL_SUBMIT (type 5)'
    ],
    setupSteps: [
      'In Discord Developer Portal > Your App > General Information.',
      'Paste your SafeWebhook endpoint into the "Interactions Endpoint URL".',
      'Respond to Discord PING type 1 challenge with {"type": 1}.',
      'Save changes.'
    ],
    samplePayload: {
      type: 2,
      id: '123456789012345678',
      application_id: '987654321098765432',
      token: 'mock_interaction_token_abc123',
      data: {
        id: '111222333444555666',
        name: 'status'
      }
    },
    verificationCodeNode: `const nacl = require('tweetnacl');

function verifyDiscordInteraction(rawBody, signature, timestamp, clientPublicKey) {
  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(clientPublicKey, 'hex')
  );
  return isVerified;
}`,
    verificationCodePython: `from nacl.signing import VerifyKey

def verify_discord_signature(raw_body, signature, timestamp, public_key):
    verify_key = VerifyKey(bytes.fromhex(public_key))
    try:
        verify_key.verify(f'{timestamp}{raw_body.decode()}'.encode(), bytes.fromhex(signature))
        return True
    except:
        return False`,
    faqs: [
      {
        q: 'Why does Discord use Ed25519 instead of HMAC?',
        a: 'Discord uses public key cryptography (Ed25519) so interactions can be securely verified without sharing a symmetric secret.'
      }
    ]
  },
  'svix': {
    slug: 'svix',
    name: 'Svix',
    category: 'Developer Tools',
    signatureHeader: 'svix-signature',
    signatureAlgorithm: 'HMAC-SHA256 (svix-id, svix-timestamp, svix-signature)',
    tagline: 'Test Svix enterprise webhooks with standard svix-signature validation on SafeWebhook.',
    description: 'Inspect and debug Svix webhooks used by modern SaaS platforms. Verify `svix-id`, `svix-timestamp`, and `svix-signature` headers.',
    sampleEvents: [
      'user.created',
      'invoice.generated',
      'organization.updated'
    ],
    setupSteps: [
      'In your Svix App Portal, click "Add Endpoint".',
      'Paste your SafeWebhook endpoint URL.',
      'Select the message types to subscribe to and click "Create".'
    ],
    samplePayload: {
      type: 'user.created',
      data: {
        id: 'usr_10293847',
        email: 'developer@example.com',
        created_at: '2026-08-19T01:50:00Z'
      }
    },
    verificationCodeNode: `const { Webhook } = require('svix');

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const wh = new Webhook(process.env.SVIX_WEBHOOK_SECRET);
  try {
    const payload = wh.verify(req.body, req.headers);
    res.status(200).json({ received: true });
  } catch (err) {
    res.status(400).send(\`Svix Error: \${err.message}\`);
  }
});`,
    verificationCodePython: `from svix.webhooks import Webhook

wh = Webhook("whsec_...")
try:
    payload = wh.verify(payload_bytes, headers_dict)
except Exception as e:
    raise e`,
    faqs: [
      {
        q: 'What headers does Svix send?',
        a: 'Svix sends svix-id (unique message ID), svix-timestamp (epoch time in seconds), and svix-signature (v1,signature_hash).'
      }
    ]
  },
  'sendgrid': {
    slug: 'sendgrid',
    name: 'SendGrid',
    category: 'Messaging & Communications',
    signatureHeader: 'X-Twilio-Email-Event-Webhook-Signature',
    signatureAlgorithm: 'ECDSA with SHA256 (P-256 curve)',
    tagline: 'Test SendGrid email event notifications (delivered, opened, bounced, clicked) on SafeWebhook.',
    description: 'Inspect SendGrid Event Webhook batches and Inbound Parse emails in real-time with zero database retention.',
    sampleEvents: [
      'delivered',
      'open',
      'click',
      'bounce',
      'spamreport'
    ],
    setupSteps: [
      'In SendGrid Settings > Mail Settings > Event Webhook.',
      'Paste your SafeWebhook URL into the HTTP POST URL field.',
      'Select events to test (Delivered, Opened, Bounced) and click "Test Your Integration".'
    ],
    samplePayload: [
      {
        email: 'john.doe@example.com',
        timestamp: 1755541200,
        event: 'delivered',
        sg_message_id: 'sendgrid_msg_id_12345.filter001',
        response: '250 2.0.0 OK'
      }
    ],
    verificationCodeNode: `const { EventWebhook, EventWebhookHeader } = require('@sendgrid/eventwebhook');

const ew = new EventWebhook();
const key = ew.convertPublicKeyToECDSA(process.env.SENDGRID_VERIFICATION_KEY);
const isValid = ew.verifySignature(key, req.body, req.headers[EventWebhookHeader.SIGNATURE], req.headers[EventWebhookHeader.TIMESTAMP]);`,
    verificationCodePython: `from sendgrid.helpers.eventwebhook import EventWebhook

ew = EventWebhook()
public_key = ew.convert_public_key_to_ecdsa(PUBLIC_KEY_STR)
is_valid = ew.verify_signature(payload_str, signature, timestamp, public_key)`,
    faqs: [
      {
        q: 'Does SendGrid send single events or array batches?',
        a: 'SendGrid sends events as an array batch of JSON objects: [{ "event": "delivered", ... }].'
      }
    ]
  }
};

export const PLATFORM_SLUGS = Object.keys(PLATFORMS);
