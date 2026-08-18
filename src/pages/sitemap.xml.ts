import type { APIRoute } from 'astro';
import { PLATFORM_SLUGS } from '../data/platforms';
import { COMPETITOR_SLUGS } from '../data/competitors';
import { USE_CASE_SLUGS } from '../data/usecases';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const baseUrl = url.origin;
  const currentDate = new Date().toISOString().slice(0, 10);

  const staticPages = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/app`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/docs`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${baseUrl}/faq`, priority: '0.8', changefreq: 'weekly' },
  ];

  const platformPages = PLATFORM_SLUGS.map((slug) => ({
    loc: `${baseUrl}/test/${slug}`,
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const competitorPages = COMPETITOR_SLUGS.map((slug) => ({
    loc: `${baseUrl}/vs/${slug}`,
    priority: '0.7',
    changefreq: 'monthly',
  }));

  const useCasePages = USE_CASE_SLUGS.map((slug) => ({
    loc: `${baseUrl}/tools/${slug}`,
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const allUrls = [...staticPages, ...platformPages, ...competitorPages, ...useCasePages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (page) => `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
