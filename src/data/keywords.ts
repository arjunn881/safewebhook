export interface KeywordCategory {
  category: string;
  keywords: string[];
}

export const SEO_KEYWORD_CLUSTERS: KeywordCategory[] = [
  {
    category: 'Core Webhook Testing & Inspection',
    keywords: [
      'webhook tester',
      'test webhook online',
      'free webhook tester',
      'webhook simulator',
      'inspect webhook payload',
      'webhook debugger',
      'webhook mock server',
      'catch webhook online',
      'inbound webhook tester',
      'test post request online',
      'http request catcher',
      'mock api endpoint free',
      'webhook replay tool',
      'webhook listener online'
    ]
  },
  {
    category: 'Competitor Displacement & Alternatives',
    keywords: [
      'webhook site alternative',
      'free alternative to webhook.site',
      'webhook.site without subscription',
      'requestbin alternative',
      'requestbin replacement free',
      'ngrok alternative free',
      'test webhooks without ngrok',
      'hookdeck alternative free',
      'beeceptor free alternative'
    ]
  },
  {
    category: 'Platform-Specific Webhook Testing',
    keywords: [
      'test stripe webhook online',
      'stripe webhook tester',
      'verify stripe signature nodejs python',
      'test github webhook',
      'github webhook inspector',
      'verify x-hub-signature-256',
      'test shopify webhook',
      'shopify webhook tester',
      'verify x-shopify-hmac-sha256',
      'test paypal webhook online',
      'paypal ipn tester',
      'test woocommerce webhook',
      'test paddle billing webhook',
      'test supabase database webhook',
      'test clerk user authentication webhook',
      'test resend email delivery webhook',
      'test slack webhook',
      'test twilio sms webhook',
      'test discord interaction webhook'
    ]
  },
  {
    category: 'Developer Workflows & Automation',
    keywords: [
      'forward webhook to localhost',
      'replay webhook to local server',
      'simulate http 500 error webhook',
      'custom webhook response status code',
      'simulate webhook timeout',
      'inject network latency webhook',
      'test email webhook online',
      'inbound email parser test',
      'forward webhook to slack channel',
      'route webhook to discord channel',
      'free cron webhook uptime monitor'
    ]
  }
];

export const ALL_TARGET_KEYWORDS = SEO_KEYWORD_CLUSTERS.flatMap(c => c.keywords);
