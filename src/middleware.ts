import { defineMiddleware } from 'astro:middleware';

const CANONICAL_HOST = 'safewebhook.com';

/**
 * Canonical redirect middleware.
 *
 * Permanently redirects all non-canonical URL variants to the canonical origin
 * (https://safewebhook.com) before any page is rendered. This resolves the
 * "Duplicate — Google chose different canonical" and "Alternate page with proper
 * canonical tag" indexing issues in Google Search Console.
 *
 * Handled cases:
 *   http://safewebhook.com/*        → https://safewebhook.com/*  (301)
 *   http://www.safewebhook.com/*    → https://safewebhook.com/*  (301)
 *   https://www.safewebhook.com/*   → https://safewebhook.com/*  (301)
 */
export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);

  const needsHttpsUpgrade = url.protocol === 'http:';
  const needsWwwStrip = url.hostname === `www.${CANONICAL_HOST}`;

  if (needsHttpsUpgrade || needsWwwStrip) {
    const canonical = new URL(url);
    canonical.protocol = 'https:';
    canonical.hostname = CANONICAL_HOST;
    return new Response(null, {
      status: 301,
      headers: {
        Location: canonical.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  return next();
});
