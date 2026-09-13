import type { APIRoute } from 'astro';
import { PLATFORM_SLUGS } from '../data/platforms';
import { COMPETITOR_SLUGS } from '../data/competitors';
import { USE_CASE_SLUGS } from '../data/usecases';
import { ERROR_GUIDE_SLUGS } from '../data/errorGuides';
import { FRAMEWORK_GUIDE_SLUGS } from '../data/frameworkGuides';
import { FAQ_CATEGORIES } from '../data/faqs';

export const prerender = true;


export const GET: APIRoute = async () => {
  const baseUrl = 'https://safewebhook.com';
  const currentDate = new Date().toISOString().slice(0, 10);

  const staticPages = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/app`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/about`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${baseUrl}/contact`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${baseUrl}/docs`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${baseUrl}/faq`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${baseUrl}/privacy`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${baseUrl}/terms`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${baseUrl}/disclaimer`, priority: '0.5', changefreq: 'monthly' },
  ];

  const hubPages = [
    { loc: `${baseUrl}/integrations`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/tools`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/vs`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${baseUrl}/errors`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${baseUrl}/guides`, priority: '0.8', changefreq: 'weekly' },
  ];

  const platformPages = PLATFORM_SLUGS.map((slug) => ({
    loc: `${baseUrl}/test/${slug}`,
    priority: '0.85',
    changefreq: 'weekly',
  }));

  const competitorPages = COMPETITOR_SLUGS.map((slug) => ({
    loc: `${baseUrl}/vs/${slug}`,
    priority: '0.75',
    changefreq: 'monthly',
  }));

  const useCasePages = USE_CASE_SLUGS.map((slug) => ({
    loc: `${baseUrl}/tools/${slug}`,
    priority: '0.85',
    changefreq: 'weekly',
  }));

  const errorPages = ERROR_GUIDE_SLUGS.map((slug) => ({
    loc: `${baseUrl}/errors/${slug}`,
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const frameworkPages = FRAMEWORK_GUIDE_SLUGS.map((slug) => ({
    loc: `${baseUrl}/guides/${slug}`,
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const faqCategoryPages = FAQ_CATEGORIES.map((cat) => ({
    loc: `${baseUrl}/faq/${cat.slug}`,
    priority: '0.85',
    changefreq: 'weekly',
  }));

  const allUrls = [
    ...staticPages,
    ...hubPages,
    ...faqCategoryPages,
    ...platformPages,
    ...competitorPages,
    ...useCasePages,
    ...errorPages,
    ...frameworkPages,
  ];


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
