# 🛡️ SafeWebhook

> **The Privacy-First, Real-Time Webhook Debugging & Inspection Platform.**
> 
> Intercept, inspect, verify HMAC signatures, replay, and forward HTTP webhooks in real-time — powered by Cloudflare Edge & Astro with zero server-side payload retention.

[![Continuous Integration](https://github.com/arjunn881/safewebhook/actions/workflows/ci.yml/badge.svg)](https://github.com/arjunn881/safewebhook/actions/workflows/ci.yml)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20Edge-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Astro](https://img.shields.io/badge/Astro-5.x-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Live Production Instance

- **Live Application**: [https://safewebhook.arjunn881.workers.dev](https://safewebhook.arjunn881.workers.dev)
- **Live Workbench**: [https://safewebhook.arjunn881.workers.dev/app](https://safewebhook.arjunn881.workers.dev/app)
- **Documentation**: [https://safewebhook.arjunn881.workers.dev/docs](https://safewebhook.arjunn881.workers.dev/docs)

---

## ✨ Features

- ⚡ **Zero-Latency Real-Time SSE Streams**: Inbound webhooks stream directly to browser sessions with zero server delays using Server-Sent Events.
- 🛡️ **Interactive Cryptographic HMAC Verifier**: Validate webhook signatures directly in the browser via WebCrypto (`crypto.subtle`) for **Stripe**, **GitHub**, **Shopify**, **Slack**, **Twilio**, **Svix**, **LemonSqueezy**, **PayPal**, and generic HMAC-SHA256/SHA1/SHA512.
- 🔁 **Instant Webhook Replay & Forwarding**: Replay any received webhook to `localhost:3000` or remote staging APIs with latency tracking and full HTTP response inspection.
- 💻 **Localhost Webhook Tunneling / Forwarder Helper**: Zero-dependency 1-liner Node.js/Python forwarder scripts to stream webhooks directly into your local development server without ngrok.
- 📝 **Custom Webhook Request Composer**: Craft and dispatch custom HTTP requests directly from the UI with preset templates for Stripe, GitHub, Shopify, Slack, Clerk, Supabase, and LemonSqueezy.
- 🔀 **Endpoint Manager & Session Switcher**: Manage multiple dedicated endpoints, label/tag test sessions, and switch between them instantly.
- ⚙️ **Custom Response & Latency Engine**: Customize HTTP status codes (200, 201, 204, 400, 429, 500, etc.), headers, response bodies, and simulated network delays (0ms – 5000ms).
- 🤖 **Automated Workflows Studio**: Configure auto-forwarding proxies, JavaScript payload transformer functions, and automated Discord / Slack alert notifications.
- 🔍 **Multi-Tier Resilient Storage**: Hybrid multi-layer persistence supporting Cloudflare D1 SQL, Cloudflare KV, and In-Memory Edge Buffers with automatic graceful failovers.
- 📦 **Multi-Language Code Generator**: Export instant replay and integration code in 9+ languages (cURL, JavaScript Fetch, Python Requests, Go, PHP, Rust, Ruby, C#, Java).
- 📧 **Inbound Email Ingestion**: Capture and inspect inbound email webhooks alongside HTTP payloads.
- 📊 **Uptime & SSL Certificate Monitor**: Perform automated health check pings and SSL certificate validations on remote endpoints.
- 💾 **Export & Import Sessions**: Download captured request logs as JSON or import previous captures to inspect offline.

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/arjunn881/safewebhook.git
cd safewebhook
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build & Preview Cloudflare Worker Locally
```bash
npm run build
npm run preview
```

---

## 📡 API Reference

### 1. Inbound Webhook Ingestion
```http
POST /api/r/:endpoint_id
GET /api/r/:endpoint_id
PUT /api/r/:endpoint_id
PATCH /api/r/:endpoint_id
DELETE /api/r/:endpoint_id
```

Send any payload with any headers to your unique endpoint URL:
```bash
curl -X POST https://safewebhook.arjunn881.workers.dev/api/r/my-endpoint \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=1755541200,v1=98a3c4f912e742c..." \
  -d '{"event": "payment_intent.succeeded", "amount": 4900, "currency": "usd"}'
```

### 2. Real-Time SSE Stream
```http
GET /api/stream/:endpoint_id
```
Establishes a persistent Server-Sent Events connection for real-time payload streaming.

### 3. Replay Webhook
```http
POST /api/replay
Content-Type: application/json

{
  "target_url": "http://localhost:3000/api/webhook",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"test\": true}"
}
```

### 4. Custom Response Configuration
```http
POST /api/config/:endpoint_id
Content-Type: application/json

{
  "statusCode": 201,
  "contentType": "application/json",
  "delayMs": 500,
  "responseBody": "{\"status\": \"created\"}"
}
```

### 5. Inbound Email Ingestion
```http
POST /api/email/:endpoint_id
Content-Type: application/json

{
  "from": "alice@example.com",
  "to": "my-endpoint@safewebhook.com",
  "subject": "Invoice Receipt",
  "text": "Hello, here is your invoice."
}
```

---

## 🚀 GitHub Actions Automated Deployment

This repository includes continuous integration and automated deployment pipelines:

### 1. Continuous Integration (`.github/workflows/ci.yml`)
- Automatically validates TypeScript types and verifies that production builds pass on every push and pull request.

### 2. Push-to-Deploy to Cloudflare Workers (`.github/workflows/deploy.yml`)
- Automatically builds and deploys to Cloudflare Workers when commits are pushed to the `master` branch.

#### Setting Up GitHub Secrets for Deployment:
1. Go to your GitHub repository: **Settings > Secrets and variables > Actions**
2. Add the following secrets:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token with Workers permissions.
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.

---

## 🛠️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│               SafeWebhook Edge Platform                │
│                                                        │
│  ┌──────────────┐     ┌──────────────┐   ┌──────────┐  │
│  │ Inbound      │     │  Real-Time   │   │ Custom   │  │
│  │ Webhook API  │ ──► │  SSE Engine  │ ──│ Response │  │
│  │ /api/r/:ep   │     │ /api/stream  │   │ Manager  │  │
│  └──────┬───────┘     └──────────────┘   └──────────┘  │
│         │                                              │
│         ▼                                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │        Hybrid Multi-Tier Storage Engine          │  │
│  │  • Cloudflare D1 SQL (Persistent History)        │  │
│  │  • Cloudflare KV (Cross-Isolate Edge Sync)       │  │
│  │  • In-Memory Ring Buffer (Zero-Latency Fallback) │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

- **Framework**: [Astro 5](https://astro.build) with SSR output mode
- **Edge Runtime**: Cloudflare Workers (`@astrojs/cloudflare`)
- **Styling**: Tailwind CSS v4 with dark mode & Vercel design system aesthetics
- **Cryptography**: Web Cryptography API (`crypto.subtle`) for client-side HMAC signature verification
- **Database**: Cloudflare D1 SQLite database with 24-hour TTL purge indexing
- **Edge Storage**: Cloudflare KV for cross-region edge isolate synchronization

---

## 📄 License

MIT © [Arjun](https://github.com/arjunn881)
