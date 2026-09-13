/**
 * IndexNow batch submission script.
 *
 * Submits all safewebhook.com sitemap URLs to IndexNow in a single API call,
 * instantly notifying Google, Bing, and Yandex of new/updated content.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs
 *
 * Run after every deployment:
 *   npm run deploy && npm run indexnow
 */

const HOST = 'safewebhook.com';
const INDEX_NOW_KEY = '5c639f31a7004fbd';
const INDEX_NOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

// Fetch the live sitemap and extract all <loc> URLs
async function getSitemapUrls() {
  console.log('📄 Fetching sitemap from https://safewebhook.com/sitemap.xml...');
  const res = await fetch('https://safewebhook.com/sitemap.xml');
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)];
  return matches.map((m) => m[1]);
}

async function submitIndexNow(urls) {
  console.log(`🚀 Submitting ${urls.length} URLs to IndexNow...`);

  const payload = {
    host: HOST,
    key: INDEX_NOW_KEY,
    keyLocation: `https://${HOST}/${INDEX_NOW_KEY}.txt`,
    urlList: urls,
  };

  const res = await fetch(INDEX_NOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (res.ok || res.status === 202) {
    console.log(`✅ IndexNow accepted ${urls.length} URLs (HTTP ${res.status})`);
  } else {
    const body = await res.text().catch(() => '');
    console.error(`❌ IndexNow rejected submission: HTTP ${res.status}`, body);
    process.exit(1);
  }
}

async function main() {
  try {
    const urls = await getSitemapUrls();
    if (urls.length === 0) {
      console.warn('⚠️  No URLs found in sitemap. Skipping submission.');
      return;
    }
    console.log(`🔍 Found ${urls.length} URLs in sitemap`);
    await submitIndexNow(urls);
    console.log('\n🎉 Done! Search engines will crawl and index these pages shortly.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
