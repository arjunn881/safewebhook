/** Canonical public origin used by metadata, feeds, and crawl files. */
export const SITE_URL = 'https://safewebhook.com';

/**
 * Escape values inserted into XML documents such as sitemap.xml and RSS.
 * Slugs are currently controlled, but keeping the serializer safe prevents a
 * future content change from producing invalid crawl files.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
