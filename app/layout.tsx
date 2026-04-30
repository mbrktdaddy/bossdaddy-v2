import type { Metadata, Viewport } from "next";
import { Geist, Montserrat, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
    default: 'Boss Daddy — Dad-Tested Product Reviews',
    template: '%s | Boss Daddy',
  },
  description:
    'Honest, dad-tested product reviews and recommendations. No corporate fluff — just real results from a real dad who buys, tests, and tells it straight.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  ),
  openGraph: {
    siteName: 'Boss Daddy Life',
    type: 'website',
    images: [{ url: '/api/og?title=Boss+Daddy+Life&type=review', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@bossdaddylife',
    creator: '@bossdaddylife',
  },
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
  themeColor: '#100c07',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${montserrat.variable} ${sourceSerif4.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
