export interface FrameworkGuide {
  slug: string;
  framework: string;
  language: string;
  title: string;
  headline: string;
  description: string;
  directAnswer: string;
  keyTakeaways: string[];
  commonGotchas: Array<{ gotcha: string; fix: string }>;
  boilerplateCode: string;
  stepByStepGuide: string[];
  howToTestLocally: string[];
  faqs: Array<{ q: string; a: string }>;
}

export type FrameworkGuideInfo = FrameworkGuide;

export const FRAMEWORK_GUIDES: Record<string, FrameworkGuide> = {
  'nextjs-app-router-webhooks': {
    slug: 'nextjs-app-router-webhooks',
    framework: 'Next.js (App Router)',
    language: 'TypeScript / JavaScript',
    title: 'How to Build & Verify Webhook Handlers in Next.js App Router',
    headline: 'Next.js App Router Webhook Guide: Raw Body & HMAC Signature Verification',
    description: 'Learn how to handle incoming webhooks (Stripe, Clerk, Resend, Shopify) in Next.js 14 & 15 App Router. Correctly read raw bodies and verify signatures.',
    directAnswer: 'In Next.js App Router (`app/api/webhook/route.ts`), use `await req.text()` to extract the raw unmodified payload string required for HMAC signature verification before parsing it with `JSON.parse()`. Do not use `req.json()` directly, as JSON normalization breaks signature hashing.',
    keyTakeaways: [
      'Use `await req.text()` to obtain the raw string for cryptographic signature checks.',
      'Always return `new Response(null, { status: 200 })` quickly to avoid timeouts.',
      'Store signing secrets in `.env.local` as `WEBHOOK_SECRET`.',
      'Use SafeWebhook Replay Drawer to test locally at `http://localhost:3000/api/webhook`.'
    ],
    commonGotchas: [
      {
        gotcha: 'Calling `await req.json()` before signature verification',
        fix: 'Call `const body = await req.text()` first, verify the signature with `body`, and then call `JSON.parse(body)`.'
      },
      {
        gotcha: 'Missing Webhook Secret environment variable',
        fix: 'Add `STRIPE_WEBHOOK_SECRET=whsec_...` to `.env.local` and restart your Next.js dev server.'
      }
    ],
    boilerplateCode: `// app/api/webhook/route.ts (Next.js 14/15 App Router)
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: Request) {
  const body = await req.text(); // Critical: Read raw text
  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(\`Webhook signature verification failed: \${err.message}\`);
    return new Response(\`Webhook Error: \${err.message}\`, { status: 400 });
  }

  // Handle specific event types
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('Payment succeeded:', paymentIntent.id);
      break;
    default:
      console.log(\`Unhandled event type: \${event.type}\`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}`,
    stepByStepGuide: [
      'Create `app/api/webhook/route.ts` in your Next.js project.',
      'Import your signature verification library (e.g. Stripe, Svix, TweetNaCl).',
      'Read the raw body via `const body = await req.text()`.',
      'Extract signature headers with `const headerList = await headers()`.',
      'Verify the signature inside a `try...catch` block and return 200 OK.'
    ],
    howToTestLocally: [
      'Start your Next.js server: `npm run dev` (running on http://localhost:3000).',
      'Create a SafeWebhook URL at safewebhook.com/app.',
      'Configure your provider (Stripe, GitHub, Shopify) with the SafeWebhook URL.',
      'Use the SafeWebhook Replay Drawer to send payloads directly to `http://localhost:3000/api/webhook`.'
    ],
    faqs: [
      {
        q: 'Why can I not use `req.json()` in Next.js webhooks?',
        a: '`req.json()` automatically parses the payload into a JavaScript object. When serialized back, differences in whitespace or property order will cause HMAC verification to fail.'
      }
    ]
  },
  'express-raw-body-webhooks': {
    slug: 'express-raw-body-webhooks',
    framework: 'Express.js',
    language: 'Node.js / JavaScript',
    title: 'How to Fix Express.js Raw Body Webhook Verification',
    headline: 'Express.js Webhook Handler Guide: Fix body-parser & Verify Signatures',
    description: 'Learn how to configure Express.js with `express.raw({ type: "application/json" })` for webhook signature verification without breaking standard JSON routes.',
    directAnswer: 'In Express.js, apply `express.raw({ type: "application/json" })` specifically to your `/api/webhook` route BEFORE applying global `app.use(express.json())`. This ensures the raw `Buffer` is available on `req.body` for cryptographic HMAC verification.',
    keyTakeaways: [
      'Mount `express.raw({ type: "application/json" })` before global `express.json()`.',
      'Use `crypto.timingSafeEqual` to compare computed hashes against headers.',
      'Convert raw buffer to JSON after signature validation via `JSON.parse(req.body.toString())`.',
      'Respond with `res.status(200).send({ received: true })`.'
    ],
    commonGotchas: [
      {
        gotcha: 'Placing `app.use(express.json())` at top of file',
        fix: 'Move `app.post("/webhook", express.raw(...))` above all global body parsing middleware.'
      }
    ],
    boilerplateCode: `// server.js (Express.js Webhook Receiver)
const express = require('express');
const crypto = require('crypto');
const app = express();

// 1. Webhook route with raw body buffer
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!signature) {
    return res.status(400).send('Missing signature');
  }

  // Compute HMAC digest using raw buffer
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.body).digest('hex');

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  if (!isValid) {
    return res.status(401).send('Signature mismatch');
  }

  // Parse JSON now that signature is verified
  const event = JSON.parse(req.body.toString('utf8'));
  console.log('Received valid event:', event);

  res.status(200).json({ received: true });
});

// 2. Global JSON parser for rest of your API
app.use(express.json());

app.listen(3000, () => console.log('Server running on port 3000'));`,
    stepByStepGuide: [
      'Define the webhook route before registering global middleware.',
      'Attach `express.raw({ type: "application/json" })` to the webhook route.',
      'Perform timing-safe HMAC validation with Node’s built-in `crypto` module.',
      'Parse the verified buffer with `JSON.parse(req.body.toString())`.',
      'Acknowledge with HTTP 200.'
    ],
    howToTestLocally: [
      'Run `node server.js` locally on port 3000.',
      'In SafeWebhook, copy the cURL export command for any captured webhook.',
      'Execute the cURL command targeting `http://localhost:3000/api/webhook`.',
      'Verify the event logs in your terminal.'
    ],
    faqs: [
      {
        q: 'Can I capture the raw body inside express.json() verify callback?',
        a: 'Yes, you can use `express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })` to attach the buffer to all incoming requests.'
      }
    ]
  },
  'fastapi-async-webhooks': {
    slug: 'fastapi-async-webhooks',
    framework: 'FastAPI',
    language: 'Python',
    title: 'How to Build Fast Async Webhook Receivers in Python FastAPI',
    headline: 'Python FastAPI Webhook Guide: Async Handlers & HMAC Signature Verification',
    description: 'Build high-performance asynchronous webhook receivers in Python FastAPI. Read raw request bytes and verify HMAC-SHA256 signatures with background tasks.',
    directAnswer: 'In FastAPI, extract raw request bytes using `await request.body()` instead of Pydantic models for signature validation. Verify the signature with Python’s `hmac.compare_digest()` before dispatching processing to `BackgroundTasks`.',
    keyTakeaways: [
      'Call `await request.body()` to get the raw `bytes` object.',
      'Use `hmac.compare_digest` for timing-safe signature comparison.',
      'Use FastAPI `BackgroundTasks` to offload work and return 200 OK in < 10ms.',
      'Parse verified bytes with `json.loads(raw_body)`.'
    ],
    commonGotchas: [
      {
        gotcha: 'Using Pydantic model parameter in route function',
        fix: 'Use `request: Request` parameter and call `await request.body()` directly to preserve exact byte formatting.'
      }
    ],
    boilerplateCode: `# main.py (FastAPI Webhook Handler)
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
import hmac
import hashlib
import json

app = FastAPI()
WEBHOOK_SECRET = "whsec_your_secret_key"

def process_webhook_payload(payload: dict):
    # Long-running background database or sync logic
    print(f"Processing event: {payload.get('type')}")

@app.post("/api/webhook")
async def webhook_listener(request: Request, background_tasks: BackgroundTasks):
    raw_body = await request.body()
    signature_header = request.headers.get("stripe-signature")

    if not signature_header:
        raise HTTPException(status_code=400, detail="Missing signature header")

    # Compute HMAC-SHA256
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    # Timing-safe signature check
    if not hmac.compare_digest(signature_header, expected_sig):
        raise HTTPException(status_code=401, detail="Signature verification failed")

    payload = json.loads(raw_body.decode("utf-8"))
    
    # Enqueue background task and respond immediately
    background_tasks.add_task(process_webhook_payload, payload)
    
    return {"status": "success"}`,
    stepByStepGuide: [
      'Import `Request`, `HTTPException`, and `BackgroundTasks` from `fastapi`.',
      'Read raw bytes via `raw_body = await request.body()`.',
      'Extract signature from `request.headers`.',
      'Compute HMAC and compare with `hmac.compare_digest()`.',
      'Schedule long-running work via `background_tasks.add_task()` and return 200.'
    ],
    howToTestLocally: [
      'Run `uvicorn main:app --port 8000 --reload`.',
      'Use SafeWebhook Replay Drawer to send captured events to `http://localhost:8000/api/webhook`.',
      'Check FastAPI terminal output for background task execution logs.'
    ],
    faqs: [
      {
        q: 'Why should I use BackgroundTasks in FastAPI webhooks?',
        a: '`BackgroundTasks` runs your processing function after the HTTP 200 response is dispatched to the client, preventing webhook gateway timeouts.'
      }
    ]
  },
  'flask-webhook-listener': {
    slug: 'flask-webhook-listener',
    framework: 'Flask',
    language: 'Python',
    title: 'How to Build Secure Webhook Listeners in Python Flask',
    headline: 'Python Flask Webhook Guide: request.get_data() & HMAC Signatures',
    description: 'Learn how to build secure webhook endpoints in Python Flask. Read raw request data with `request.get_data()` and verify Stripe & GitHub signatures.',
    directAnswer: 'In Flask, use `request.get_data()` to access the raw unparsed bytes before calling `request.get_json()`. Pass `request.get_data()` to your HMAC verification function to prevent signature errors.',
    keyTakeaways: [
      'Access raw request bytes with `request.get_data()`.',
      'Always use `hmac.compare_digest()` for timing-safe validation.',
      'Return `jsonify({"received": True}), 200` to acknowledge delivery.',
      'Use SafeWebhook to test Flask routes on localhost:5000.'
    ],
    commonGotchas: [
      {
        gotcha: 'Calling `request.json` before verifying signature',
        fix: 'Access `request.get_data()` first for signature verification.'
      }
    ],
    boilerplateCode: `# app.py (Flask Webhook Listener)
from flask import Flask, request, jsonify, abort
import hmac
import hashlib

app = Flask(__name__)
SECRET_KEY = b"your_signing_secret"

@app.route('/api/webhook', methods=['POST'])
def webhook_handler():
    raw_payload = request.get_data()
    sig_header = request.headers.get('X-Hub-Signature-256')

    if not sig_header:
        abort(400, description="Missing signature")

    computed_sig = 'sha256=' + hmac.new(SECRET_KEY, raw_payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(sig_header, computed_sig):
        abort(401, description="Invalid signature")

    event = request.get_json()
    print(f"Received GitHub event: {event.get('action')}")

    return jsonify({"status": "received"}), 200

if __name__ == '__main__':
    app.run(port=5000)`,
    stepByStepGuide: [
      'Import `Flask`, `request`, and `jsonify`.',
      'Read raw payload bytes with `request.get_data()`.',
      'Verify signature against `request.headers.get(...)`.',
      'Parse JSON with `request.get_json()` after verification.',
      'Return 200 OK.'
    ],
    howToTestLocally: [
      'Run `python app.py` (running on http://localhost:5000).',
      'Use SafeWebhook Replay Drawer to replay captured events to `http://localhost:5000/api/webhook`.'
    ],
    faqs: [
      {
        q: 'Does Flask cache request.get_data()?',
        a: 'Yes, Flask caches the raw data stream so both `request.get_data()` and `request.get_json()` can be called in the same request lifecycle.'
      }
    ]
  },
  'django-rest-webhooks': {
    slug: 'django-rest-webhooks',
    framework: 'Django / Django REST Framework',
    language: 'Python',
    title: 'How to Implement Webhook Views in Django & Django REST Framework',
    headline: 'Django Webhook Guide: @csrf_exempt & HMAC Signature Verification',
    description: 'Learn how to build secure webhook receivers in Django. Exempt webhook routes from CSRF protection and access `request.body` for HMAC validation.',
    directAnswer: 'In Django, apply the `@csrf_exempt` decorator to your webhook view function to prevent 403 Forbidden CSRF errors. Access `request.body` (raw bytes) to compute HMAC-SHA256 signatures before parsing with `json.loads()`.',
    keyTakeaways: [
      'Always add `@csrf_exempt` to webhook views.',
      'Use `request.body` for raw payload bytes.',
      'Validate signatures with `hmac.compare_digest()`.',
      'Use Celery tasks to process heavy webhook workflows asynchronously.'
    ],
    commonGotchas: [
      {
        gotcha: 'HTTP 403 Forbidden CSRF error',
        fix: 'Add `@csrf_exempt` decorator above the view function.'
      }
    ],
    boilerplateCode: `# views.py (Django Webhook View)
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
import hmac
import hashlib
import json
import os

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "secret").encode('utf-8')

@csrf_exempt
def webhook_receiver(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Only POST method allowed")

    raw_body = request.body
    signature = request.headers.get('X-Signature')

    if not signature:
        return HttpResponseBadRequest("Missing signature")

    computed = hmac.new(WEBHOOK_SECRET, raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(signature, computed):
        return HttpResponseForbidden("Invalid signature")

    data = json.loads(raw_body.decode('utf-8'))
    # Trigger Celery task: process_event.delay(data)

    return JsonResponse({"status": "received"}, status=200)`,
    stepByStepGuide: [
      'Import `@csrf_exempt` from `django.views.decorators.csrf`.',
      'Decorate your view with `@csrf_exempt`.',
      'Read raw bytes from `request.body`.',
      'Verify signature and return `JsonResponse({"status": "received"}, status=200)`.'
    ],
    howToTestLocally: [
      'Run `python manage.py runserver 8000`.',
      'Forward webhooks from SafeWebhook to `http://localhost:8000/api/webhook/`.'
    ],
    faqs: [
      {
        q: 'Why does Django require @csrf_exempt on webhook views?',
        a: 'Django enforces CSRF token validation on all POST requests by default. Webhooks originate from external servers without session cookies, so they must be exempted.'
      }
    ]
  },
  'go-gin-webhooks': {
    slug: 'go-gin-webhooks',
    framework: 'Go (Gin Framework)',
    language: 'Go (Golang)',
    title: 'How to Implement Webhook Handlers in Go Gin',
    headline: 'Go Gin Webhook Guide: c.GetRawData() & crypto/hmac Verification',
    description: 'Learn how to build high-performance webhook handlers in Golang with Gin framework. Read raw payload bytes with `c.GetRawData()` and verify HMAC signatures.',
    directAnswer: 'In Go Gin, read raw bytes using `c.GetRawData()` before binding JSON models. Compute HMAC digests with standard library `crypto/hmac` and `crypto/sha256`, and verify with `hmac.Equal()`.',
    keyTakeaways: [
      'Use `c.GetRawData()` to retrieve raw request bytes.',
      'Use `hmac.Equal(macA, macB)` for constant-time cryptographic verification.',
      'Unmarshal JSON into Go structs after successful validation.',
      'Acknowledge with `c.JSON(http.StatusOK, gin.H{"status": "ok"})`.'
    ],
    commonGotchas: [
      {
        gotcha: 'Calling `c.ShouldBindJSON()` before getting raw bytes',
        fix: 'Call `body, err := c.GetRawData()` first, verify, then `json.Unmarshal(body, &payload)`.'
      }
    ],
    boilerplateCode: `// main.go (Go Gin Webhook Receiver)
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

var webhookSecret = []byte("your_webhook_secret")

func WebhookHandler(c *gin.Context) {
	// 1. Get raw request bytes
	rawData, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// 2. Extract signature header
	sigHeader := c.GetHeader("X-Hub-Signature-256")
	if sigHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing signature header"})
		return
	}

	// 3. Verify HMAC-SHA256
	mac := hmac.New(sha256.New, webhookSecret)
	mac.Write(rawData)
	expectedMAC := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(sigHeader), []byte(expectedMAC)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	// 4. Unmarshal JSON safely
	var event map[string]interface{}
	if err := json.Unmarshal(rawData, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func main() {
	r := gin.Default()
	r.POST("/api/webhook", WebhookHandler)
	r.Run(":8080")
}`,
    stepByStepGuide: [
      'Call `rawData, err := c.GetRawData()` in your Gin handler.',
      'Compute HMAC using `crypto/hmac` and `crypto/sha256`.',
      'Verify with `hmac.Equal()`.',
      'Decode payload into a Go struct with `json.Unmarshal()`.',
      'Return `c.JSON(http.StatusOK, ...)`.'
    ],
    howToTestLocally: [
      'Run `go run main.go` (running on :8080).',
      'Use SafeWebhook Replay Drawer to send test payloads to `http://localhost:8080/api/webhook`.'
    ],
    faqs: [
      {
        q: 'Why use hmac.Equal() instead of == in Go?',
        a: '`hmac.Equal()` performs a constant-time comparison, preventing timing side-channel attacks when validating signatures.'
      }
    ]
  },
  'laravel-webhook-controller': {
    slug: 'laravel-webhook-controller',
    framework: 'Laravel',
    language: 'PHP',
    title: 'How to Build & Verify Webhook Handlers in Laravel',
    headline: 'Laravel Webhook Guide: CSRF Exclusion & spatie/laravel-webhook-client',
    description: 'Learn how to build robust webhook controllers in Laravel. Exclude routes from CSRF verification and validate HMAC signatures using Spatie Webhook Client.',
    directAnswer: 'In Laravel, add your webhook route `api/webhook/*` to the `$except` array in `app/Http/Middleware/VerifyCsrfToken.php` (or `bootstrap/app.php` in Laravel 11). Access raw content via `$request->getContent()` for HMAC signature validation.',
    keyTakeaways: [
      'Exclude webhook route in `VerifyCsrfToken` middleware.',
      'Use `$request->getContent()` to retrieve unmodified raw string.',
      'Use `hash_equals()` for timing-safe signature comparison.',
      'Dispatch background jobs using Laravel Queues.'
    ],
    commonGotchas: [
      {
        gotcha: 'CSRF token mismatch 419 error',
        fix: 'Add route to `$except` in CSRF middleware or register in `routes/api.php`.'
      }
    ],
    boilerplateCode: `<?php
// app/Http/Controllers/WebhookController.php (Laravel 10/11)

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class WebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $rawPayload = $request->getContent(); // Raw body string
        $signature = $request->header('X-Signature');
        $secret = config('services.webhook.secret');

        if (!$signature) {
            return response()->json(['error' => 'Missing signature'], 400);
        }

        $expectedSignature = hash_hmac('sha256', $rawPayload, $secret);

        if (!hash_equals($signature, $expectedSignature)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $data = json_decode($rawPayload, true);
        
        // Dispatch job: ProcessWebhookEvent::dispatch($data);

        return response()->json(['status' => 'success'], 200);
    }
}`,
    stepByStepGuide: [
      'Create controller: `php artisan make:controller WebhookController`.',
      'Register route in `routes/api.php` (exempt from CSRF by default).',
      'Retrieve raw body via `$request->getContent()`.',
      'Compare signatures with `hash_equals()`.',
      'Return `response()->json(["status" => "success"], 200)`.'
    ],
    howToTestLocally: [
      'Run `php artisan serve` (running on http://localhost:8000).',
      'Use SafeWebhook Replay Drawer to send captured events to `http://localhost:8000/api/webhook`.'
    ],
    faqs: [
      {
        q: 'Why should I use hash_equals() in PHP?',
        a: '`hash_equals()` provides timing-safe string comparison to protect against timing attacks in signature validation.'
      }
    ]
  }
};

export const FRAMEWORK_GUIDE_SLUGS = Object.keys(FRAMEWORK_GUIDES);
