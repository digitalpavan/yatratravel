import type { MetadataRoute } from 'next';
import { getPackages, getPosts } from '@/lib/data';
import { landingPages } from '@/lib/landing-pages';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/packages', '/tirupati-darshan', '/vehicles', '/book', '/about', '/contact', '/blog', '/privacy'];
  const [packages, posts] = await Promise.all([getPackages(), getPosts()]);
  return [
    ...pages.map(p => ({ url: `${siteUrl}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...landingPages.map(p => ({ url: `${siteUrl}/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.9 })),
    ...packages.map(p => ({ url: `${siteUrl}/packages/${p.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...posts.map(p => ({ url: `${siteUrl}/blog/${p.slug}`, lastModified: p.date || undefined, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
