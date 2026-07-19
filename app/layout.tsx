import type { Metadata, Viewport } from "next";
import { Geist, Montserrat, Source_Serif_4, Fraunces } from "next/font/google";
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

// Editorial display serif — Manifesto v2 design system. Carries the
// magazine/"cover story" voice on Cover Story, editorial section H2s, guide
// titles, and the mission Creed. Scoped opt-in via `font-editorial-display`
// (see docs/brand-guide.md §3 + docs/home-manifesto-spec.md) — headings stay
// Montserrat font-black by default. Source Serif 4 remains for article
// blockquotes.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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
const defaultOgImage = ogImageMeta({ title: 'Boss Daddy Life', type: 'review', alt: 'Boss Daddy Life — Boss Dads. Built Different.' })

export const metadata: Metadata = {
  title: {
    default: 'Boss Daddy — Dad Like a Boss',
    template: '%s | Boss Daddy',
  },
  description:
    'Boss Dads. Built Different. Honest reviews, smart tools, and real-dad wisdom for men who Dad Like a Boss — zero paid placements, zero fluff.',
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
  // Opt into large image thumbnails + untruncated snippets in Google results
  // (Search + Discover). Pages that need to stay out of the index (bench, search,
  // empty tag pages) override `robots` themselves.
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
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
      className={`${geistSans.variable} ${montserrat.variable} ${sourceSerif4.variable} ${fraunces.variable} h-full antialiased`}
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
