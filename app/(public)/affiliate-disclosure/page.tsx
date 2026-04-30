import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
 title: 'Affiliate Disclosure — Boss Daddy Life',
 description: 'How Boss Daddy Life makes money, how affiliate links work, and why commissions never influence our recommendations. We buy everything ourselves first.',
 openGraph: { title: 'Affiliate Disclosure — Boss Daddy Life', images: [{ url: '/api/og?title=Affiliate+Disclosure&type=article', width: 1200, height: 630 }] },
 twitter: { card: 'summary_large_image' },
 alternates: { canonical: '/affiliate-disclosure' },
}

const LAST_UPDATED = 'April 19, 2026'
const CONTACT_EMAIL = 'hello@bossdaddylife.com'

export default function AffiliateDisclosurePage() {
 return (
 <div className="max-w-3xl mx-auto px-6 py-16">

 <h1 className="text-3xl font-black mb-2">Affiliate Disclosure</h1>
 <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

 <div className="prose prose-invert max-w-none
 prose-p:text-gray-400 prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-base prose-h3:mt-6
 prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
 prose-ul:text-gray-400 prose-li:my-1
 prose-strong:text-white">

 <p>
 Boss Daddy LLC (doing business as Boss Daddy Life) is reader-supported. We make money through affiliate commissions
 when you click certain links on this site and go on to buy something. No sponsors.
 No paid placements. No one paying us to say nice things about their product. This
 page explains exactly how it works.
 </p>

 <h2>How We Make Money</h2>
 <p>
 When you click an affiliate link on Boss Daddy Life and make a qualifying purchase,
 we earn a small commission — at <strong>no additional cost to you</strong>. You pay
 the same price you would have paid going direct. The retailer pays us a cut for
 sending you their way.
 </p>
 <p>We participate in the following affiliate programs:</p>
 <ul>
 <li>Amazon Associates</li>
 <li>ShareASale</li>
 <li>Commission Junction (CJ)</li>
 <li>Impact</li>
 <li>Direct brand affiliate programs</li>
 </ul>
 <p>
 Affiliate links appear in reviews and guides. Where they appear,
 you&apos;ll see a disclosure at the top of that page.
 </p>

 <h2>Commissions Don&apos;t Influence Reviews</h2>
 <p>
 <strong>This is the one that matters.</strong> We do not accept payment in exchange
 for positive coverage. We do not let commission rates decide what we recommend.
 If a higher-paying product isn&apos;t worth your money, we&apos;ll say so — or we won&apos;t
 cover it at all.
 </p>
 <p>
 The review came first. The affiliate link came second. Not the other way around.
 </p>

 <h2>What &quot;Boss Daddy Approved&quot; Means in This Context</h2>
 <p>
 When you see a product marked <strong>Boss Daddy Approved</strong>, the designation
 was earned by real testing — in the backyard, the garage, the living room, the job
 site, the driveway. Not by commission rate. Not by a brand deal. A product earns
 the badge because it held up in use, delivered on its claims, and we&apos;d put our
 own money down for it again.
 </p>
 <p>
 Affiliate commission has zero influence on which products get approved. A brand
 paying us more does not move their product up the list. For the full methodology,
 see our <Link href="/editorial-standards">Editorial Standards</Link>.
 </p>

 <h2>Our Review Standard</h2>
 <p>
 Every product we review editorially has been <strong>personally purchased</strong>,
 personally used, or we have <strong>direct firsthand knowledge</strong> of it. The
 founder does not accept free products in exchange for reviews. Neither do our
 contributors.
 </p>
 <p>
 If a product doesn&apos;t clear that bar, it doesn&apos;t get an editorial review on
 this site.
 </p>

 <h2>Promotional Content — Clearly Labeled</h2>
 <p>
 Separate from editorial reviews, Boss Daddy Life may run{' '}
 <strong>promotional content</strong> such as contests, giveaways, and wish lists.
 These are always clearly labeled as promotional and are kept distinct from editorial
 reviews. Promotional features do not influence ratings, verdicts, or the Boss Daddy
 Approved designation.
 </p>

 <h2>AI-Assisted Content Disclosure</h2>
 <p>
 We use AI tools — including Anthropic&apos;s Claude — to help draft and research
 content. We&apos;re telling you that straight out because it&apos;s the honest thing to do.
 Here&apos;s how we use it:
 </p>
 <ul>
 <li>Every AI-assisted piece is reviewed and approved by a human on the Boss Daddy team before it&apos;s published.</li>
 <li>Product ratings, verdicts, and firsthand observations come from humans who have actually used the product.</li>
 <li>AI helps with drafting, structure, and research. It does not substitute for lived experience, and it does not make the final call on what&apos;s worth your money.</li>
 <li>Where AI assistance is substantial, we note it.</li>
 </ul>
 <p>
 This is consistent with FTC guidance on AI-generated content, and it&apos;s laid out
 in more detail in our <Link href="/editorial-standards">Editorial Standards</Link>.
 </p>

 <h2>Human Contributors</h2>
 <p>
 Boss Daddy Life works with human editors, writers, and content managers in addition
 to the founder. Everyone is held to the same rules: firsthand knowledge, honest
 opinions, no paid placements. Any contributor with a material connection to a
 product, brand, or company they&apos;re writing about is required to disclose it —
 to us, and to you, on the page where it matters.
 </p>

 <h2>FTC Compliance — In Plain English</h2>
 <p>
 The{' '}
 <strong>Federal Trade Commission&apos;s Endorsement Guides (16 CFR Part 255)</strong>{' '}
 require anyone endorsing a product to disclose any material connection to the brand
 they&apos;re endorsing. Translation: if we&apos;re going to make money when you buy something
 based on what we said, you have a right to know that before you click. That&apos;s
 what this page — and the notices at the top of review pages — are for.
 </p>
 <p>
 The same goes for AI assistance. Per FTC guidance on AI-generated content, we
 disclose when AI tools have been used substantially in creating a piece.
 </p>

 <h2>Questions</h2>
 <p>
 Questions about how we make money, how a specific review came together, or any
 affiliate relationship on this site — ask us.{' '}
 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We&apos;ll answer straight.
 </p>

 </div>

 <div className="mt-10 pt-8 flex items-center gap-6 flex-wrap text-sm">
 <Link href="/editorial-standards" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Editorial Standards
 </Link>
 <Link href="/privacy-policy" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Privacy Policy
 </Link>
 <Link href="/terms" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Terms of Service
 </Link>
 </div>

 </div>
 )
}
