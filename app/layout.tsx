import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
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
        { url: '/feed/articles.xml',  title: 'Boss Daddy Life — Articles' },
      ],
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
