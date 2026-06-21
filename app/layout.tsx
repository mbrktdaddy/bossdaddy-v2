import type { Metadata, Viewport } from "next";
import { Geist, Montserrat, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PwaInstallProvider from "@/components/pwa/PwaInstallProvider";
import { ogImageMeta } from "@/lib/og";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// Social/search domain-verification meta tags. Env-gated — each is a no-op
// until you claim the domain and set its code:
//   NEXT_PUBLIC_FB_DOMAIN_VERIFY  → Meta Business Suite domain verification
//   NEXT_PUBLIC_PINTEREST_VERIFY  → Pinterest "claim website" + Rich Pins
const socialVerification: Record<string, string> = {}
if (process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFY) socialVerification['facebook-domain-verification'] = process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFY
if (process.env.NEXT_PUBLIC_PINTEREST_VERIFY) socialVerification['p:domain_verify'] = process.env.NEXT_PUBLIC_PINTEREST_VERIFY

// Shared default preview image for the homepage and any page that inherits the
// root metadata. Used by BOTH openGraph.images and twitter.images.
const defaultOgImage = ogImageMeta({ title: 'Boss Daddy Life', type: 'review', alt: 'Boss Daddy Life — Dad like a BOSS' })

export const metadata: Metadata = {
  title: {
    default: 'Boss Daddy — Dad like a BOSS',
    template: '%s | Boss Daddy',
  },
  description:
    'The gold standard for men who Dad like a BOSS. Honest reviews, practical guides, and real-dad wisdom — zero sponsors, zero fluff.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  ),
  openGraph: {
    siteName: 'Boss Daddy Life',
    type: 'website',
    locale: 'en_US',
    images: [defaultOgImage],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@bossdaddylife',
    creator: '@bossdaddylife',
    // Next.js does NOT copy openGraph.images into twitter — without this, the
    // homepage (and any root-inheriting page) emits no twitter:image and X
    // renders no card. Per-page metadata sets its own twitter.images.
    images: [defaultOgImage],
  },
  ...(Object.keys(socialVerification).length ? { verification: { other: socialVerification } } : {}),
  alternates: {
    types: {
      'application/rss+xml': [
        { url: '/feed.xml',           title: 'Boss Daddy Life — All' },
        { url: '/feed/reviews.xml',   title: 'Boss Daddy Life — Reviews' },
        { url: '/feed/guides.xml',    title: 'Boss Daddy Life — Guides' },
      ],
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Status-bar / browser-chrome tint. Dark to match the dark header that sits
  // at the top of every page (the body canvas is light zinc-100, but the header
  // is what borders the status bar). Kept identical to the manifest's
  // theme_color + background_color (#0a0a0a) so launch shows no color flash.
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${montserrat.variable} ${sourceSerif4.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaInstallProvider>
          {children}
        </PwaInstallProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
