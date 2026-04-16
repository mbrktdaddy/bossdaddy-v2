import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Affiliate Disclosure — Boss Daddy Life',
  description: 'Our affiliate disclosure policy. We earn commissions from qualifying purchases — but it never influences our reviews.',
}

export default function AffiliateDisclosurePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">

      <h1 className="text-3xl font-black mb-2">Affiliate Disclosure</h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: {new Date().getFullYear()}</p>

      <div className="prose prose-invert max-w-none
        prose-p:text-gray-400 prose-p:leading-relaxed
        prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
        prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
        prose-strong:text-white">

        <p>
          Boss Daddy Life participates in affiliate marketing programs, which means we may earn
          a commission when you click a link and make a purchase — at no extra cost to you.
        </p>

        <h2>How It Works</h2>
        <p>
          Some links on this site are affiliate links, primarily through the Amazon Associates
          Program. When you click one of these links and make a qualifying purchase, we receive
          a small commission from the retailer.
        </p>

        <h2>Our Promise</h2>
        <p>
          <strong>Affiliate relationships never influence our reviews.</strong> Every product
          reviewed on this site was purchased by us with our own money. We do not accept free
          products in exchange for reviews, and we do not accept payment for positive coverage.
          If we don&apos;t like something, we say so.
        </p>
        <p>
          Our ratings and recommendations are based solely on real-world testing and our honest
          opinion — not on whether a product has an affiliate program or how much commission it pays.
        </p>

        <h2>FTC Compliance</h2>
        <p>
          In accordance with the Federal Trade Commission&apos;s guidelines, we disclose any material
          connections between us and the products or services we recommend. Where affiliate links
          are present in a review or article, you will see a disclosure notice at the top of that page.
        </p>

        <h2>Questions?</h2>
        <p>
          If you have any questions about our affiliate relationships or disclosure practices,
          feel free to reach out. We believe in full transparency with our readers.
        </p>

      </div>

      <div className="mt-10 pt-8 border-t border-gray-800">
        <Link href="/reviews" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
          ← Back to Reviews
        </Link>
      </div>

    </div>
  )
}
