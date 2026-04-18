import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Editorial Standards — Boss Daddy Life',
  description: 'How reviews earn "Boss Daddy Approved," how we use AI, and the rules every contributor follows. No paid placements, no sponsored ratings.',
}

const LAST_UPDATED = 'April 17, 2026'
const CONTACT_EMAIL = 'hello@bossdaddylife.com'

export default function EditorialStandardsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">

      <h1 className="text-3xl font-black mb-2">Editorial Standards</h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-invert max-w-none
        prose-p:text-gray-400 prose-p:leading-relaxed
        prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
        prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-base prose-h3:mt-6
        prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
        prose-ul:text-gray-400 prose-li:my-1
        prose-strong:text-white">

        <p>
          Boss Daddy Life exists because dads deserve straight talk about the gear, tools, and
          products they spend real money on. This page lays out the rules we write by. If
          something you read here ever falls short of these standards, we want to hear about it.
        </p>

        <h2>1. Review Eligibility</h2>
        <p>
          A product gets a full editorial review on this site only if at least one of the
          following is true:
        </p>
        <ul>
          <li><strong>We bought it with our own money.</strong> No review copies, no gifted units, no loaners in exchange for coverage.</li>
          <li><strong>We have direct firsthand knowledge of it.</strong> We&apos;ve owned it, used it, or worked with it long enough to speak to it honestly.</li>
          <li><strong>It&apos;s clearly labeled as promotional.</strong> Contests, giveaways, and wish-list features are allowed — but they are always labeled and kept separate from editorial reviews.</li>
        </ul>
        <p>
          If a product doesn&apos;t clear that bar, we don&apos;t review it. We&apos;d rather publish less
          and mean every word than pad the site with stuff we haven&apos;t actually put hands on.
        </p>

        <h2>2. What &quot;Boss Daddy Approved&quot; Means</h2>
        <p>
          <strong>&quot;Boss Daddy Approved&quot;</strong> is not a slogan we stick on anything we want
          to sell. It&apos;s a designation a product has to earn — tested in the places dads
          actually use this stuff, holding up over time, worth buying again. Commission rate,
          brand size, and marketing budget have zero influence on it.
        </p>
        <p>
          For exactly how a product earns the badge, see{' '}
          <Link href="/how-we-test">How We Test</Link>.
        </p>

        <h2>3. AI Usage Policy</h2>
        <p>
          We use AI tools — specifically Anthropic&apos;s Claude — to help draft and research
          content. We&apos;re transparent about that because we&apos;d rather tell you up front than
          have you wonder. Here&apos;s exactly how it works:
        </p>
        <ul>
          <li><strong>AI drafts. Humans decide.</strong> Every article, review, and buying guide is reviewed and approved by a human on the Boss Daddy team before it goes live.</li>
          <li><strong>AI never substitutes for lived experience.</strong> Firsthand observations, real-world testing notes, and verdicts come from humans who have actually used the product.</li>
          <li><strong>Ratings are always human-verified.</strong> No rating, score, or final recommendation is published without a person signing off on it.</li>
          <li><strong>AI helps with research and structure.</strong> Specs, comparisons, pros-and-cons framing, plain-English explanations — AI is a good tool for that. It is not a good tool for telling you whether something is worth your money. That&apos;s a human call.</li>
        </ul>
        <p>
          Where AI assistance is substantial, we note it. This is how we read FTC guidance on
          AI-generated content, and it&apos;s how we&apos;d want to be told if the roles were reversed.
        </p>

        <h2>4. Contributor Standards</h2>
        <p>
          Boss Daddy Life is founder-led, but it&apos;s not a one-man operation. We work with
          human editors, writers, and content managers. Every contributor is held to the same
          standards as the founder:
        </p>
        <ul>
          <li>No paid placements. No sponsored ratings. No &quot;pay to play.&quot;</li>
          <li>Firsthand knowledge or direct experience is required for any editorial review.</li>
          <li>Any material connection to a product, brand, or company a contributor writes about — personal relationship, prior employment, free product received, equity stake, or anything else that could reasonably affect credibility — must be disclosed to us in writing before the piece is published, and disclosed on the page where it&apos;s relevant to readers.</li>
          <li>Contributors cannot accept gifts, payment, or perks from a brand in exchange for coverage. If a brand tries, we walk away and tell you about it.</li>
        </ul>

        <h2>5. Rating Methodology</h2>
        <p>
          Our ratings are not a black box. When we score a product, we&apos;re weighing a few
          consistent factors:
        </p>
        <ul>
          <li><strong>Build quality:</strong> Does it feel like it was made to last, or made to make a sale?</li>
          <li><strong>Performance:</strong> Does it do what it claims, under real conditions, not just on paper?</li>
          <li><strong>Value:</strong> At the price it sells for, is it a smart buy? This is not the same as &quot;cheapest.&quot;</li>
          <li><strong>Ease of use:</strong> Can a regular dad actually get the benefit out of this without a manual, an instructor, or a second trip to the hardware store?</li>
          <li><strong>Longevity:</strong> Based on firsthand use or reliable knowledge, will this still be working a year from now? Five?</li>
        </ul>
        <p>
          Ratings reflect the honest judgment of the person doing the testing. They are not
          generated by an algorithm, and they are not influenced by affiliate payouts.
        </p>

        <h2>6. Corrections and Updates</h2>
        <p>
          We get things wrong sometimes. When we do, we fix it — publicly, not quietly.
        </p>
        <ul>
          <li><strong>Errors of fact</strong> are corrected as soon as we confirm them. Where a correction materially changes the meaning of a review, we note what was changed and when.</li>
          <li><strong>Outdated reviews</strong> get flagged when a product has been discontinued, reformulated, or significantly changed. Where we can, we update the review. Where we can&apos;t, we mark it as historical.</li>
          <li><strong>If you spot something wrong,</strong> tell us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We take it seriously.</li>
        </ul>

        <h2>7. What We Don&apos;t Do</h2>
        <ul>
          <li><strong>No paid placements.</strong> You cannot buy a review, a ranking, or a mention.</li>
          <li><strong>No gifted-product reviews in the editorial section.</strong> If we didn&apos;t pay for it or have direct firsthand knowledge of it, it doesn&apos;t go in a review.</li>
          <li><strong>No sponsored ratings.</strong> A brand cannot pay to raise a score or change a verdict.</li>
          <li><strong>No sponsors.</strong> Full stop.</li>
        </ul>
        <p>
          Promotional content like contests, giveaways, and wish lists is allowed — but it&apos;s
          labeled, it&apos;s separated from editorial reviews, and it never affects ratings.
        </p>

        <h2>8. Questions</h2>
        <p>
          If anything on this site seems off, if a review feels like it crossed a line, or if
          you just want to know how a specific piece was put together — reach out. Straight
          answers, every time.
        </p>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>

      </div>

      <div className="mt-10 pt-8 border-t border-gray-800 flex items-center gap-6 flex-wrap text-sm">
        <Link href="/how-we-test" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
          How We Test
        </Link>
        <Link href="/affiliate-disclosure" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
          Affiliate Disclosure
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
