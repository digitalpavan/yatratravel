import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer, PreviewBanner, WhatsAppFab } from '@/components/Footer';
import { getPackages, getSettings } from '@/lib/data';
import { contactLinks, nav } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const { seo, brand } = await getSettings();
  return {
    title: { default: seo.title, template: `%s | ${brand.name}` },
    description: seo.description,
    openGraph: { type: 'website', siteName: brand.name, locale: 'en_IN' },
    // Keep preview builds out of search results until the business details are verified in /admin/content.
    robots: brand.verified ? undefined : { index: false, follow: false },
  };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [settings, packages] = await Promise.all([getSettings(), getPackages()]);
  const links = contactLinks(settings.contact);
  return (
    <>
      {!settings.brand.verified && <PreviewBanner />}
      <Header nav={nav} phoneHref={links.phoneHref} phoneLabel={links.phoneLabel} whatsappHref={links.whatsappHref()} />
      <main id="main">{children}</main>
      <Footer settings={settings} links={links} packages={packages.slice(0, 5).map(p => ({ slug: p.slug, title: p.title }))} />
      <WhatsAppFab href={links.whatsappHref()} />
    </>
  );
}
