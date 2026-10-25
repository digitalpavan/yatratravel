import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Manrope } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/components.css';
import '@/styles/site.css';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { siteUrl } from '@/lib/site';

const manrope = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-manrope', display: 'swap' });
// Body text: not preloaded, so on slow connections the hero photo (the homepage LCP) isn't competing with 48 KB of font.
// Text shows at once in the size-matched fallback and swaps when Inter arrives. Manrope (headings, often the LCP) stays preloaded.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap', preload: false });

export const metadata = { metadataBase: new URL(siteUrl), icons: { icon: '/images/branding/yatra-mark.svg' } };
export const viewport: Viewport = { themeColor: '#101C2C' };

// Shared shell for the public site (app/(site)) and the dashboard (app/admin).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${manrope.variable} ${inter.variable}`} data-scroll-behavior="smooth">
      <head>
        {/* Animated elements start hidden until JavaScript reveals them; without JavaScript, show everything. */}
        <noscript><style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style></noscript>
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
