# SafeWebhook Deployment & Domain Configuration

SafeWebhook has been deployed to Cloudflare Workers with Edge SSR and global asset distribution.

## 🚀 Live Production Details

- **Live URL**: [https://safewebhook.arjunn881.workers.dev](https://safewebhook.arjunn881.workers.dev)
- **Live Workbench**: [https://safewebhook.arjunn881.workers.dev/app](https://safewebhook.arjunn881.workers.dev/app)
- **Live Sitemap**: [https://safewebhook.arjunn881.workers.dev/sitemap.xml](https://safewebhook.arjunn881.workers.dev/sitemap.xml)
- **Cloudflare KV Binding**: `safewebhook-session`

---

## 🌐 Linking Your Custom Domain (`safewebhook.com`)

To route `safewebhook.com` directly to this Cloudflare Worker:

### Option 1: Via Cloudflare Dashboard (Recommended & Instant)
1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **safewebhook**
3. Go to the **Settings** tab > **Domains & Routes**
4. Click **Add** > **Custom Domain**
5. Enter `safewebhook.com` (and `www.safewebhook.com`)
6. Cloudflare will automatically configure DNS records and issue an instant SSL certificate.

### Option 2: Via Wrangler CLI
Add the route definition to [`wrangler.jsonc`](file:///d:/CODE/mitool/wrangler.jsonc):
```jsonc
{
  "name": "safewebhook",
  "routes": [
    { "pattern": "safewebhook.com/*", "zone_name": "safewebhook.com" },
    { "pattern": "www.safewebhook.com/*", "zone_name": "safewebhook.com" }
  ]
}
```
Then run `npm run deploy`.
