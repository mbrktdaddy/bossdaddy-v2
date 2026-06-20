import type { Metadata, Viewport } from "next";
import { Geist, Montserrat, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PwaInstallProvider from "@/components/pwa/PwaInstallProvider";
import { ogImageUrl } from "@/lib/og";
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
    images: [{ url: ogImageUrl({ title: 'Boss Daddy Life', type: 'review' }), width: 1200, height: 630, alt: 'Boss Daddy Life — Dad like a BOSS' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@bossdaddylife',
    creator: '@bossdaddylife',
  },
  // Pinterest domain claim: once you claim bossdaddylife.com in a Pinterest
  // business account, set NEXT_PUBLIC_PINTEREST_VERIFY to the code it gives you.
  // No-op until then. Claiming the domain + the article OG tags = Rich Pins.
  ...(process.env.NEXT_PUBLIC_PINTEREST_VERIFY
    ? { verification: { other: { 'p:domain_verify': process.env.NEXT_PUBLIC_PINTEREST_VERIFY } } }
    : {}),
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
