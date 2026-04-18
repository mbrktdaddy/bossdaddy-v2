import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Boss Daddy Life',
  description: 'What we collect, what we do with it, and what you can ask us to do with your data. Plain English.',
}

const LAST_UPDATED = 'April 17, 2026'
const CONTACT_EMAIL = 'hello@bossdaddylife.com'

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">

      <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-invert max-w-none
        prose-p:text-gray-400 prose-p:leading-relaxed
        prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
        prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-base prose-h3:mt-6
        prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
        prose-ul:text-gray-400 prose-li:my-1
        prose-strong:text-white">

        <p>
          Boss Daddy Life (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates{' '}
          <strong>bossdaddylife.com</strong>. This page explains what we collect, how we
          use it, and the rights you have over your data. We&apos;ve tried to write this in
          plain English. If anything here is unclear, email us and we&apos;ll clear it up.
        </p>

        <h2>1. What We Collect</h2>

        <h3>What You Give Us Directly</h3>
        <ul>
          <li><strong>Account info:</strong> Email and password when you sign up.</li>
          <li><strong>Comments:</strong> Anything you post in the comments on a review or article.</li>
          <li><strong>Contact:</strong> Your name and email if you write to us.</li>
          <li><strong>Newsletter:</strong> Your email if you subscribe to the list.</li>
        </ul>

        <h3>What&apos;s Collected Automatically</h3>
        <ul>
          <li><strong>Usage:</strong> Pages visited, time on page, clicks, and where you came from — standard web analytics.</li>
          <li><strong>Device:</strong> Browser, operating system, and IP address.</li>
          <li><strong>Cookies:</strong> Small files stored on your device to keep you logged in and to understand how the site is used (see Section 4).</li>
        </ul>

        <h3>What Third Parties Share With Us</h3>
        <ul>
          <li>If you click an affiliate link and buy something, the affiliate network may send us aggregate numbers (e.g., conversion counts). We don&apos;t see the details of your purchase.</li>
        </ul>

        <h2>2. What We Use It For</h2>
        <ul>
          <li>Creating and running your account</li>
          <li>Publishing comments you submit</li>
          <li>Sending newsletters or updates you asked for</li>
          <li>Answering questions and support requests</li>
          <li>Understanding how the site is used so we can make it better</li>
          <li>Meeting legal obligations</li>
        </ul>
        <p>
          <strong>We do not sell your personal data.</strong> We do not build advertising
          profiles on you. We do not run targeted ads against your behavior on this site.
        </p>

        <h2>3. AI Tools and Your Data</h2>
        <p>
          We use AI tools — specifically Anthropic&apos;s Claude — to help draft and research
          content for the site. Here&apos;s what that means for your data:
        </p>
        <ul>
          <li><strong>Your personal data is not passed to AI.</strong> We don&apos;t feed user accounts, emails, comments, or browsing history into AI tools.</li>
          <li><strong>AI is used internally for content creation only.</strong> It&apos;s a writing and research tool. It is not used for personalization, user profiling, or deciding what content to show a specific user.</li>
          <li><strong>AI does not make editorial decisions.</strong> Every AI-assisted piece is reviewed and approved by a human before publish. See our <Link href="/editorial-standards">Editorial Standards</Link> for details.</li>
        </ul>

        <h2>4. Cookies</h2>
        <p>Two types:</p>
        <ul>
          <li><strong>Essential cookies:</strong> Needed for the site to work (for example, keeping you logged in). These can&apos;t be turned off without breaking things.</li>
          <li><strong>Analytics cookies:</strong> Help us see traffic and usage patterns. You can disable these in your browser.</li>
        </ul>
        <p>
          You control cookies through your browser settings. If you disable essential cookies,
          you won&apos;t be able to log in.
        </p>

        <h2>5. Affiliate Links and Third-Party Services</h2>
        <p>
          This site has affiliate links. Clicking one sends you to a third-party site (like
          Amazon) that has its own privacy policy. Read theirs before you buy. We&apos;re not
          responsible for how third-party sites handle your data.
        </p>
        <p>We use these third-party services to run the site:</p>
        <ul>
          <li><strong>Supabase</strong> — authentication and database</li>
          <li><strong>Vercel</strong> — website hosting</li>
          <li><strong>Resend</strong> — transactional and newsletter email delivery</li>
          <li><strong>Cloudflare</strong> — DNS and email routing</li>
          <li><strong>Upstash Redis</strong> — rate limiting (no personal data stored)</li>
          <li><strong>Anthropic (Claude)</strong> — AI content drafting and research (no user data passed in)</li>
          <li><strong>Amazon Associates and other affiliate networks</strong> — affiliate tracking</li>
        </ul>

        <h2>6. How Long We Keep It</h2>
        <ul>
          <li><strong>Account data:</strong> As long as your account is active. Ask us to delete it any time.</li>
          <li><strong>Comments:</strong> Stay up unless you ask us to remove them or we remove them under our moderation policy.</li>
          <li><strong>Newsletter email:</strong> Until you unsubscribe.</li>
          <li><strong>Analytics:</strong> Kept in aggregate. We don&apos;t keep individual session data long-term.</li>
        </ul>

        <h2>7. Security</h2>
        <p>
          We use standard protections: HTTPS everywhere, hashed passwords, row-level security
          on the database. No system on the internet is 100% secure, and we can&apos;t guarantee
          perfect security. We do our best and fix anything we find.
        </p>

        <h2>8. Kids</h2>
        <p>
          This site isn&apos;t for children under 13. We don&apos;t knowingly collect data from
          anyone under 13. If you think we&apos;ve accidentally collected data from a child,
          email us and we&apos;ll delete it.
        </p>

        <h2>9. Your Rights</h2>
        <p>
          Depending on where you live (GDPR in the EU/UK, CCPA in California, and similar
          laws elsewhere), you have rights over your data. In plain English:
        </p>
        <ul>
          <li><strong>See it:</strong> Ask for a copy of what we hold on you.</li>
          <li><strong>Fix it:</strong> Ask us to correct anything wrong.</li>
          <li><strong>Delete it:</strong> Ask us to erase your data.</li>
          <li><strong>Take it:</strong> Ask for your data in a format you can take somewhere else.</li>
          <li><strong>Object to it:</strong> Tell us to stop certain kinds of processing.</li>
          <li><strong>Opt out of sale:</strong> We don&apos;t sell data, so you&apos;re already covered.</li>
        </ul>
        <p>
          For EU/UK users, the legal bases we rely on are: <strong>contract</strong> (to run
          your account), <strong>legitimate interests</strong> (to operate and improve the
          site), <strong>consent</strong> (for newsletter and non-essential cookies — you
          can withdraw any time), and <strong>legal obligation</strong> (where the law
          requires it).
        </p>
        <p>
          To exercise any of these rights, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We&apos;ll respond within
          30 days.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this page over time. When we do, the &quot;Last updated&quot; date at the
          top changes. Continued use of the site after an update means you accept the new
          version.
        </p>

        <h2>11. Contact</h2>
        <p>
          Any privacy question, any request — email{' '}
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
        <Link href="/terms" className="text-gray-500 hover:text-gray-400 transition-colors">
          Terms of Service
        </Link>
      </div>

    </div>
  )
}
