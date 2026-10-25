import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { BackgroundMusic } from '@/components/BackgroundMusic';
import { Header } from '@/components/Header';
import { BookingPopup, WhatsAppFab } from '@/components/BookingPopup';
import { Footer, PreviewBanner } from '@/components/Footer';
import { getPackages, getSettings } from '@/lib/data';
import { getImage } from '@/lib/images';
import { contactLinks, nav } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const { seo, brand } = await getSettings();
  // Default share image for pages without their own (pages that set openGraph replace this object, so they add their own image).
  const share = getImage('tirumala-hero');
  return {
    title: { default: seo.title, template: `%s | ${brand.name}` },
    description: seo.description,
    openGraph: {
      type: 'website', siteName: brand.name, locale: 'en_IN',
      ...(share && { images: [{ url: share.src, width: share.width, height: share.height, alt: share.alt }] }),
    },
    twitter: { card: 'summary_large_image' },
    // Google Search Console: the HTML-tag verification code (content="…") from Search Console → Settings → Ownership.
    ...(process.env.GOOGLE_SITE_VERIFICATION && { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }),
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
      <Footer settings={settings} links={links} />
      <WhatsAppFab href={links.whatsappHref()} />
      <BookingPopup packages={packages.map(p => ({ slug: p.slug, title: p.title }))} whatsappNumber={links.whatsappNumber} brand={settings.brand.name} />
      {/* Looping background music. Put the file at public/audio/background-music.mp3, or set NEXT_PUBLIC_BACKGROUND_MUSIC_URL. */}
      <BackgroundMusic src={process.env.NEXT_PUBLIC_BACKGROUND_MUSIC_URL || '/audio/background-music.mp3'} />
      {/* Real-user Core Web Vitals. Turn on Speed Insights in the Vercel project first, then set NEXT_PUBLIC_SPEED_INSIGHTS=1. */}
      {process.env.NEXT_PUBLIC_SPEED_INSIGHTS === '1' && <SpeedInsights />}
    </>
  );
}
