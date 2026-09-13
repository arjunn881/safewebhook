import type { APIRoute } from 'astro';

const INDEX_NOW_KEY = '5c639f31a7004fbd';
const HOST = 'safewebhook.com';
const INDEX_NOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * POST /api/indexnow
 *
 * Protected IndexNow batch submission endpoint.
 * Collects all sitemap URLs and submits them to IndexNow in a single call,
 * instantly notifying Google, Bing, and Yandex.
 *
 * Auth: Requires X-IndexNow-Key header matching the site key.
 */
export const POST: APIRoute = async ({ request, url: reqUrl }) => {
  // Simple key-based auth to prevent unauthorized submissions
  const authKey = request.headers.get('X-IndexNow-Key');
  if (authKey !== INDEX_NOW_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch the live sitemap to collect all URLs
    const sitemapUrl = `${reqUrl.origin}/sitemap.xml`;
    const sitemapRes = await fetch(sitemapUrl);
    if (!sitemapRes.ok) {
      throw new Error(`Failed to fetch sitemap: ${sitemapRes.status}`);
    }
    const xml = await sitemapRes.text();
    const matches = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)];
    const urls = matches.map((m) => m[1]);

    if (urls.length === 0) {
      return new Response(JSON.stringify({ error: 'No URLs found in sitemap' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Submit to IndexNow
    const payload = {
      host: HOST,
      key: INDEX_NOW_KEY,
      keyLocation: `https://${HOST}/${INDEX_NOW_KEY}.txt`,
      urlList: urls,
    };

    const indexNowRes = await fetch(INDEX_NOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const accepted = indexNowRes.ok || indexNowRes.status === 202;

    return new Response(
      JSON.stringify({
        success: accepted,
        submitted: urls.length,
        indexNowStatus: indexNowRes.status,
        urls,
      }),
      {
        status: accepted ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
