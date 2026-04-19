import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Boss Daddy Life',
  description: 'What we collect, what we do with it, and what you can ask us to do with your data. Plain English.',
}

const LAST_UPDATED = 'April 19, 2026'
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
          <strong>Boss Daddy LLC</strong>, an Illinois limited liability company doing business
          as Boss Daddy Life (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), operates{' '}
          <strong>bossdaddylife.com</strong>. This page explains what we collect, how we use
          it, and the rights you have over your data. We&apos;ve tried to write this in plain
          English. If anything is unclear, email us and we&apos;ll clear it up.
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
          <li>If you click an affiliate link and make a purchase, the affiliate network may send us aggregate numbers (e.g., conversion counts). We do not see the details of your purchase.</li>
        </ul>

        <h2>2. What We Use It For</h2>
        <ul>
          <li>Creating and running your account</li>
          <li>Publishing comments you submit</li>
          <li>Sending newsletters or updates you asked for</li>
          <li>Answering questions and support requests</li>
          <li>Understanding how the site is used so we can improve it</li>
          <li>Meeting legal obligations under federal and Illinois law</li>
          <li>Enforcing our <Link href="/terms">Terms of Use</Link></li>
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
          <li><strong>AI is used internally for content creation only.</strong> It is not used for personalization, user profiling, or deciding what content to show a specific user.</li>
          <li><strong>AI does not make editorial decisions.</strong> Every AI-assisted piece is reviewed and approved by a human before publication. See our <Link href="/editorial-standards">Editorial Standards</Link> for details.</li>
        </ul>

        <h2>4. Cookies</h2>
        <p>Two types:</p>
        <ul>
          <li><strong>Essential cookies:</strong> Needed for the site to work (e.g., keeping you logged in). These cannot be disabled without breaking functionality.</li>
          <li><strong>Analytics cookies:</strong> Help us see traffic and usage patterns. You can disable these in your browser settings.</li>
        </ul>
        <p>
          You control cookies through your browser settings. If you disable essential cookies,
          you won&apos;t be able to log in or use member features.
        </p>

        <h2>5. Affiliate Links and Third-Party Services</h2>
        <p>
          This site has affiliate links. Clicking one sends you to a third-party site (like
          Amazon) that has its own privacy policy. We are not responsible for how third-party
          sites handle your data — read their policies before you buy.
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
        <p>
          Each of these third parties has its own privacy policy governing their handling of
          data. We select vendors with reasonable privacy and security practices, but we are
          not responsible for their independent data handling.
        </p>

        <h2>6. How Long We Keep It</h2>
        <ul>
          <li><strong>Account data:</strong> As long as your account is active. Ask us to delete it any time.</li>
          <li><strong>Comments:</strong> Remain published unless you ask us to remove them or we remove them under our moderation policy.</li>
          <li><strong>Newsletter email:</strong> Until you unsubscribe.</li>
          <li><strong>Analytics:</strong> Kept in aggregate. We do not retain individual session data long-term.</li>
          <li><strong>Support correspondence:</strong> Retained as long as necessary to resolve your request and as required by law.</li>
        </ul>

        <h2>7. Data Disposal</h2>
        <p>
          When personal data is no longer needed and we have no legal obligation to retain it,
          we dispose of it securely. For digital records, this means deletion from our database
          and any backups within a reasonable period. We do not retain personal data beyond
          what is necessary for the purposes described in this policy, consistent with the{' '}
          <strong>Illinois Personal Information Protection Act (815 ILCS 530)</strong>.
        </p>

        <h2>8. Security</h2>
        <p>
          We implement and maintain reasonable security measures to protect personal information
          against unauthorized access, use, modification, and disclosure. These include HTTPS
          everywhere, hashed passwords, and row-level security on our database. No system on
          the internet is 100% secure. We do our best and address any vulnerabilities we find
          promptly.
        </p>

        <h2>9. Data Breach Notification</h2>
        <p>
          If we discover a security breach that compromises your personal information, we will
          notify you and, where required, the Illinois Attorney General, consistent with the{' '}
          <strong>Illinois Personal Information Protection Act (815 ILCS 530/10 et seq.)</strong>.
          For purposes of this policy, &quot;personal information&quot; means your first name or
          first initial and last name combined with any of the following when not encrypted:
        </p>
        <ul>
          <li>Social Security number</li>
          <li>Driver&apos;s license or state ID number</li>
          <li>Financial account number with access credentials</li>
          <li>Medical or health insurance information</li>
          <li>Username and password that would permit access to an account</li>
        </ul>
        <p>
          We will notify affected individuals without unreasonable delay, and no later than
          is required by applicable law. If a breach affects more than 500 Illinois residents,
          we will notify the Illinois Attorney General within the timeframe required by law.
          Notification will be sent to the email address associated with your account.
        </p>

        <h2>10. Kids</h2>
        <p>
          This site is not directed to children under 13. We do not knowingly collect personal
          information from anyone under 13 in compliance with the{' '}
          <strong>Children&apos;s Online Privacy Protection Act (COPPA)</strong>. If you believe
          we have inadvertently collected data from a child under 13, email us immediately
          and we will delete it.
        </p>

        <h2>11. Email Communications (CAN-SPAM)</h2>
        <p>
          If you subscribe to our newsletter or request updates, we will send you commercial
          emails in compliance with the{' '}
          <strong>CAN-SPAM Act (15 U.S.C. § 7701 et seq.)</strong>. Each commercial email we
          send includes:
        </p>
        <ul>
          <li>A clear subject line that accurately describes the content</li>
          <li>Our physical mailing address</li>
          <li>A clear and conspicuous unsubscribe link</li>
        </ul>
        <p>
          You can unsubscribe at any time using the link in any email we send, or by emailing{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will process your
          opt-out promptly.
        </p>

        <h2>12. Your Rights</h2>
        <p>
          Depending on where you live — GDPR in the EU/UK, CCPA in California, Illinois PIPA,
          and similar laws — you have rights over your data:
        </p>
        <ul>
          <li><strong>See it:</strong> Ask for a copy of what we hold on you.</li>
          <li><strong>Fix it:</strong> Ask us to correct anything wrong.</li>
          <li><strong>Delete it:</strong> Ask us to erase your data.</li>
          <li><strong>Take it:</strong> Ask for your data in a portable format.</li>
          <li><strong>Object to it:</strong> Tell us to stop certain kinds of processing.</li>
          <li><strong>Opt out of sale:</strong> We don&apos;t sell data, so you&apos;re already covered.</li>
        </ul>
        <p>
          For EU/UK users, the legal bases we rely on are: <strong>contract</strong> (to run
          your account), <strong>legitimate interests</strong> (to operate and improve the
          site), <strong>consent</strong> (for newsletter and non-essential cookies — you can
          withdraw any time), and <strong>legal obligation</strong> (where the law requires it).
        </p>
        <p>
          To exercise any of these rights, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within
          30 days.
        </p>

        <h2>13. Governing Law</h2>
        <p>
          This Privacy Policy is governed by the laws of the <strong>State of Illinois</strong>,
          including the Illinois Personal Information Protection Act (815 ILCS 530) and the
          Illinois Consumer Fraud and Deceptive Business Practices Act (815 ILCS 505). To
          the extent federal privacy law applies, we comply with that as well.
        </p>

        <h2>14. Changes to This Policy</h2>
        <p>
          We may update this page over time. When we do, the &quot;Last updated&quot; date changes.
          For material changes, we will make reasonable efforts to notify you by email or a
          notice on the Site before the changes take effect. Continued use of the site after
          an update means you accept the revised policy.
        </p>

        <h2>15. Contact</h2>
        <p>
          Any privacy question, any request — email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          Boss Daddy LLC<br />
          State of Illinois<br />
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>

      </div>

      <div className="mt-10 pt-8 border-t border-gray-800 flex items-center gap-6 flex-wrap text-sm">
        <Link href="/editorial-standards" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
          Editorial Standards
        </Link>
        <Link href="/affiliate-disclosure" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
          Affiliate Disclosure
        </Link>
        <Link href="/terms" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
          Terms of Use
        </Link>
      </div>

    </div>
  )
}
