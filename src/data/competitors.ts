export interface CompetitorComparison {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  pricingDifference: string;
  privacyDifference: string;
  latencyDifference: string;
  advantages: string[];
  limitations: string[];
  faqs: Array<{ q: string; a: string }>;
}

export const COMPETITORS: Record<string, CompetitorComparison> = {
  'webhook-site': {
    slug: 'webhook-site',
    name: 'Webhook.site',
    tagline: 'Why SafeWebhook is 100% Free & Faster than Webhook.site (Zero Paywalls, Zero Limits)',
    summary: 'Webhook.site charges $15 to $45/month for basic features like custom responses, search, and permanent URLs. SafeWebhook (safewebhook.com) offers all of these features 100% free with sub-20ms edge latency and zero server disk storage.',
    pricingDifference: 'Webhook.site puts custom responses, search, and extended storage behind $15-$45/month paywalls. SafeWebhook is 100% Free forever with 0 subscription tiers.',
    privacyDifference: 'Webhook.site stores user data and payloads on remote central servers. SafeWebhook streams in memory and stores logs solely in your local browser.',
    latencyDifference: 'Webhook.site uses centralized European servers (200-500ms global latency). SafeWebhook runs on Cloudflare Edge with 300+ locations (< 20ms latency).',
    advantages: [
      '100% Free Forever with Zero Paywalls at safewebhook.com',
      'Sub-20ms global edge delivery via Server-Sent Events',
      'Private local-only storage (zero server disk writes)',
      'Built-in Custom HTTP Response & Latency Simulation Engine',
      '8+ Language Code Export (cURL, JS, Python, Go, PHP, Rust)',
      'Automated Workflows & JavaScript Transformation Studio',
      'Matching Inbound Email Address included for free'
    ],
    limitations: [
      'Webhook.site locks search and custom actions behind paid plans',
      'Webhook.site imposes 7-day expiration limits on unpaid URLs',
      'Webhook.site stores sensitive payload tokens on server disks'
    ],
    faqs: [
      {
        q: 'Is SafeWebhook an alternative to Webhook.site Pro?',
        a: 'Yes. SafeWebhook includes features from Webhook.site Pro (custom response codes, headers, delay simulation, search filters, and replay) completely free of charge at safewebhook.com.'
      },
      {
        q: 'Do I need an account to use SafeWebhook?',
        a: 'No account, email, or password required. Open safewebhook.com and start testing immediately.'
      }
    ]
  },
  'ngrok': {
    slug: 'ngrok',
    name: 'Ngrok',
    tagline: 'Browser-Based SafeWebhook vs Ngrok Local Tunneling CLI',
    summary: 'Ngrok requires downloading binary executables, terminal configurations, and authentication tokens. SafeWebhook provides an instant browser-based edge endpoint with zero downloads.',
    pricingDifference: 'Ngrok charges for custom static domains and persistent endpoints. SafeWebhook provides free instant endpoints with one-click localhost replay proxy.',
    privacyDifference: 'Ngrok routes all local traffic through their central tunnel servers. SafeWebhook lets you selectively replay individual payloads to localhost.',
    latencyDifference: 'Both offer sub-50ms latency; SafeWebhook operates via Cloudflare Edge SSE without requiring open inbound ports.',
    advantages: [
      'Zero installation, zero terminal setup, and zero account required',
      'Visual timeline inspector with formatted JSON and parsed headers',
      '1-Click Replay Drawer to send payloads to localhost:8000',
      'Works behind strict corporate firewalls without installing binaries'
    ],
    limitations: [
      'Ngrok requires installing and running CLI processes on your machine',
      'Ngrok free accounts display interstitial security warning pages'
    ],
    faqs: [
      {
        q: 'Can SafeWebhook replace Ngrok for webhook debugging?',
        a: 'Yes. For testing webhooks, you can receive payloads at your SafeWebhook edge URL and forward them to localhost using our built-in Replay Drawer.'
      }
    ]
  },
  'requestbin': {
    slug: 'requestbin',
    name: 'RequestBin',
    tagline: 'Modern 100% Free SafeWebhook vs Legacy RequestBin',
    summary: 'RequestBin was acquired and merged into complex workflow platforms requiring logins and credit cards. SafeWebhook brings back the fast, no-login developer experience with modern edge SSE streaming.',
    pricingDifference: 'RequestBin requires an account and plan upgrades. SafeWebhook is 100% free with no account.',
    privacyDifference: 'RequestBin stores historical bins on cloud databases. SafeWebhook is 100% private and stores logs only in your browser memory.',
    latencyDifference: 'SafeWebhook uses 300+ global edge locations for sub-20ms SSE delivery.',
    advantages: [
      'No account creation or credit card required',
      'Real-time streaming (SSE) without refreshing the page',
      'Custom HTTP status code configurator',
      'Integrated Inbound Email Address and Uptime Monitor'
    ],
    limitations: [
      'RequestBin forces login and redirects to workflow dashboard',
      'RequestBin limits bin duration and request history'
    ],
    faqs: [
      {
        q: 'Why choose SafeWebhook over RequestBin?',
        a: 'SafeWebhook is completely free, does not require a login, updates in real-time via Server-Sent Events, and keeps all sensitive request data private in your browser at safewebhook.com.'
      }
    ]
  },
  'hookdeck': {
    slug: 'hookdeck',
    name: 'Hookdeck',
    tagline: 'Instant Zero-Signup Webhook Debugger vs Hookdeck Enterprise Gateway',
    summary: 'Hookdeck is an enterprise event gateway requiring multi-step account creation, workspace setups, and monthly team subscriptions. SafeWebhook gives individual developers instant edge inspection with zero setup.',
    pricingDifference: 'Hookdeck charges $39 to $249/mo for team tiers. SafeWebhook is 100% free with zero paywalls.',
    privacyDifference: 'Hookdeck records and stores event histories in multi-tenant cloud storage. SafeWebhook streams purely in memory to local storage.',
    latencyDifference: 'Both offer sub-50ms latency; SafeWebhook runs directly on Cloudflare global edge network.',
    advantages: [
      'Instant access without creating an organization or signing up',
      'Visual response status and delay simulator included for free',
      'Integrated Inbound Email Inboxes for hybrid testing',
      'Zero server persistence guarantees privacy for development credentials'
    ],
    limitations: [
      'Hookdeck requires account onboarding and complex workspace configuration',
      'Hookdeck restricts free tier event history limits'
    ],
    faqs: [
      {
        q: 'When should I use SafeWebhook instead of Hookdeck?',
        a: 'Use SafeWebhook when you need to immediately test, debug, inspect, or replay a webhook during development without creating accounts or setting up gateways.'
      }
    ]
  },
  'beeceptor': {
    slug: 'beeceptor',
    name: 'Beeceptor',
    tagline: 'No-Login Edge Webhook Inspector vs Beeceptor Mock Server',
    summary: 'Beeceptor limits free endpoints to 50 requests/day and locks CORS proxying and advanced rules behind paid tiers. SafeWebhook provides unrestricted, real-time edge testing with zero request caps.',
    pricingDifference: 'Beeceptor charges $10 to $40/month to remove daily limits. SafeWebhook has no daily limits or payment tiers.',
    privacyDifference: 'Beeceptor stores endpoint definitions and logs centrally. SafeWebhook runs fully in browser memory.',
    latencyDifference: 'SafeWebhook delivers sub-20ms edge latency via Server-Sent Events.',
    advantages: [
      'No 50 req/day artificial throttling limits',
      'Integrated HMAC signature verifiers for Stripe, GitHub, Shopify',
      'Matching email endpoint for every session',
      'Real-time streaming UI without manual polling'
    ],
    limitations: [
      'Beeceptor caps free tier at 50 requests per day',
      'Beeceptor requires upgrading for unlimited endpoints'
    ],
    faqs: [
      {
        q: 'Are there any daily request limits on SafeWebhook?',
        a: 'No. SafeWebhook does not throttle or limit your testing requests.'
      }
    ]
  }
};

export const COMPETITOR_SLUGS = Object.keys(COMPETITORS);
