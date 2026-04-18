import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — Boss Daddy Life',
  description: 'The ground rules for using bossdaddylife.com. Straight talk, not legalese.',
}

const LAST_UPDATED = 'April 17, 2026'
const CONTACT_EMAIL = 'hello@bossdaddylife.com'

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">

      <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-invert max-w-none
        prose-p:text-gray-400 prose-p:leading-relaxed
        prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
        prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-base prose-h3:mt-6
        prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
        prose-ul:text-gray-400 prose-li:my-1
        prose-strong:text-white">

        <p>
          These Terms govern your use of <strong>bossdaddylife.com</strong> (the &quot;Site&quot;),
          operated by Boss Daddy Life (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). Using the Site means
          you agree to what&apos;s on this page. If you don&apos;t, don&apos;t use the Site. We&apos;ve
          kept the language as plain as we can. Where the law makes us use a specific term,
          we do.
        </p>

        <h2>1. Using the Site</h2>
        <p>You can use the Site for personal, non-commercial reading. Don&apos;t:</p>
        <ul>
          <li>Use it for anything illegal</li>
          <li>Scrape, harvest, or bulk-extract content without written permission from us</li>
          <li>Try to break into any part of the Site or its systems</li>
          <li>Post false, harmful, or deceptive stuff (spam, abuse, impersonation)</li>
          <li>Interfere with how the Site normally runs</li>
        </ul>

        <h2>2. Accounts</h2>
        <p>
          To comment, like, save, or use other member features, you need an account. You&apos;re
          on the hook for:
        </p>
        <ul>
          <li>Keeping your login secure</li>
          <li>What happens under your account</li>
          <li>Giving us accurate info when you sign up</li>
        </ul>
        <p>
          We can suspend or close accounts that break these Terms, abuse the community, or
          sit unused for a long time.
        </p>

        <h2>3. Community Conduct</h2>
        <p>
          Boss Daddy Life is a hub for dads who show up every day. That&apos;s the crowd we
          built this for, and it&apos;s the crowd we protect. You&apos;re welcome here if you can
          keep it to a few basics:
        </p>
        <ul>
          <li><strong>Respect other dads.</strong> Disagree, push back, argue your case — but do it like a man, not a troll. Personal attacks, slurs, and harassment get you removed.</li>
          <li><strong>Good faith only.</strong> Don&apos;t impersonate other users, the founder, or the brand. Don&apos;t spread things you know are false to stir the pot. Don&apos;t post bad-faith reviews meant to hurt a competitor or prop one up.</li>
          <li><strong>Keep it on topic.</strong> This isn&apos;t the place for political warfare, religious arguments unrelated to the content, or self-promotion dressed up as a comment.</li>
          <li><strong>No gaming the community.</strong> No sock puppets, no vote manipulation, no coordinated brigading, no fake accounts pumping a product or trashing one.</li>
          <li><strong>No harm to minors.</strong> Content that endangers or exploits children will be removed and reported. Zero tolerance.</li>
          <li><strong>Keep it legal.</strong> No threats, no illegal content, no doxxing, no stolen material.</li>
        </ul>
        <p>
          We moderate in good faith, not by algorithm. If you get removed, it&apos;s because a
          human looked at it and made a call. If you think we got it wrong, email us —
          we&apos;ll hear you out.
        </p>

        <h2>4. Your Content</h2>
        <p>
          When you submit a comment or any other content to the Site, you give Boss Daddy
          Life a non-exclusive, royalty-free, worldwide license to display and distribute
          that content on the Site. You keep ownership of what you wrote.
        </p>
        <p>Don&apos;t submit content that is:</p>
        <ul>
          <li>Defamatory, harassing, threatening, or abusive</li>
          <li>Infringing on someone else&apos;s copyright, trademark, or privacy</li>
          <li>Spam, ads, or promotional junk you didn&apos;t clear with us</li>
          <li>False, misleading, or fraudulent</li>
        </ul>
        <p>
          Comments are moderated before they&apos;re published. We remove anything that breaks
          these rules, at our discretion.
        </p>

        <h2>5. Our Content</h2>
        <p>
          Original content on this Site — reviews, articles, images, graphics, the Boss
          Daddy Life brand — belongs to or is licensed to us, and it&apos;s protected by
          copyright and trademark law.
        </p>
        <p>
          Linking to our content and quoting short excerpts with credit is fine. Republishing
          full reviews or articles without written permission is not.
        </p>

        <h2>6. Affiliate Links and Commercial Relationships</h2>
        <p>
          This Site contains affiliate links. When you make a qualifying purchase through one,
          we earn a small commission at no additional cost to you.{' '}
          <strong>Commissions do not influence our reviews or ratings.</strong> No sponsors.
          No paid placements. No sponsored ratings. For the full picture, read our{' '}
          <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>.
        </p>

        <h2>7. AI Content and Editorial Disclaimers</h2>
        <p>
          Some content on this Site has been drafted or researched with the help of AI tools.
          Every AI-assisted piece is reviewed and approved by a human before it&apos;s published.
          AI never substitutes for lived experience, and ratings are always human-verified.
          Full details are in our <Link href="/editorial-standards">Editorial Standards</Link>.
        </p>
        <p>
          Product reviews and recommendations are honest opinions based on firsthand
          experience or direct knowledge. They are not professional advice — not medical,
          not financial, not legal, not anything else. Do your own research before you buy.
        </p>

        <h2>8. &quot;As Is&quot; Disclaimer</h2>
        <p>
          Content on this Site is provided <strong>&quot;as is&quot;</strong> for information and
          entertainment. Boss Daddy Life makes no warranties, express or implied, about
          accuracy, completeness, or fitness for any particular purpose.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the fullest extent allowed by law, Boss Daddy Life is not liable for indirect,
          incidental, special, or consequential damages from your use of — or inability to
          use — this Site or its content. That includes loss of data, loss of profits, and
          damages from relying on content found here.
        </p>

        <h2>10. Third-Party Links</h2>
        <p>
          The Site links out to third-party sites. Those links are there for your convenience.
          We don&apos;t endorse, control, or take responsibility for what happens on sites we
          don&apos;t run.
        </p>

        <h2>11. Privacy</h2>
        <p>
          Your use of the Site is also governed by our{' '}
          <Link href="/privacy-policy">Privacy Policy</Link>, which is part of these Terms.
        </p>

        <h2>12. Changes to These Terms</h2>
        <p>
          We can update these Terms. Changes take effect when they&apos;re posted here.
          Continued use after an update means you accept the new version.
        </p>

        <h2>13. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the United States. Disputes will be
          resolved in a court of competent jurisdiction in the United States.
        </p>

        <h2>14. Contact</h2>
        <p>
          Questions about these Terms?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

      </div>

      <div className="mt-10 pt-8 border-t border-gray-800 flex items-center gap-6 flex-wrap text-sm">
        <Link href="/editorial-standards" className="text-gray-500 hover:text-gray-400 transition-colors">
          Editorial Standards
        </Link>
        <Link href="/affiliate-disclosure" className="text-gray-500 hover:text-gray-400 transition-colors">
          Affiliate Disclosure
        </Link>
        <Link href="/privacy-policy" className="text-gray-500 hover:text-gray-400 transition-colors">
          Privacy Policy
        </Link>
      </div>

    </div>
  )
}
