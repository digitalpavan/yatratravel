import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/data';
import { siteUrl } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Block everything until the business details are marked verified in /admin/content.
  if (!(await getSettings()).brand.verified) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/booking-confirmation/'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
