import type { APIRoute } from 'astro';
import { PLATFORMS } from '../data/platforms';
import { USE_CASES } from '../data/usecases';
import { COMPETITORS } from '../data/competitors';
import { ERROR_GUIDES } from '../data/errorGuides';
import { FRAMEWORK_GUIDES } from '../data/frameworkGuides';

export const prerender = true;

export const GET: APIRoute = async () => {
  const baseUrl = 'https://safewebhook.com';
  const buildDate = new Date().toUTCString();

  const items = [
    ...Object.values(PLATFORMS).map((p) => ({
      title: `How to Test and Verify ${p.name} Webhooks`,
      link: `${baseUrl}/test/${p.slug}`,
      description: p.description,
      pubDate: 'Wed, 19 Aug 2026 00:00:00 GMT',
      guid: `${baseUrl}/test/${p.slug}`,
    })),
    ...Object.values(USE_CASES).map((u) => ({
      title: u.name,
      link: `${baseUrl}/tools/${u.slug}`,
      description: u.description,
      pubDate: 'Wed, 19 Aug 2026 00:00:00 GMT',
      guid: `${baseUrl}/tools/${u.slug}`,
    })),
    ...Object.values(COMPETITORS).map((c) => ({
      title: `SafeWebhook vs ${c.name} — Feature & Architecture Comparison`,
      link: `${baseUrl}/vs/${c.slug}`,
      description: c.summary,
      pubDate: 'Wed, 19 Aug 2026 00:00:00 GMT',
      guid: `${baseUrl}/vs/${c.slug}`,
    })),
    ...Object.values(ERROR_GUIDES).map((e) => ({
      title: e.title,
      link: `${baseUrl}/errors/${e.slug}`,
      description: e.description,
      pubDate: 'Wed, 19 Aug 2026 00:00:00 GMT',
      guid: `${baseUrl}/errors/${e.slug}`,
    })),
    ...Object.values(FRAMEWORK_GUIDES).map((f) => ({
      title: f.title,
      link: `${baseUrl}/guides/${f.slug}`,
      description: f.description,
      pubDate: 'Wed, 19 Aug 2026 00:00:00 GMT',
      guid: `${baseUrl}/guides/${f.slug}`,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SafeWebhook Developer Hub &amp; Integration Guides</title>
    <link>${baseUrl}</link>
    <description>Zero-login webhook debugging tools, platform guides, error troubleshooting, and cryptographic signature verifiers.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
    ${items
      .map(
        (item) => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.guid}</guid>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
    </item>`
      )
      .join('')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
