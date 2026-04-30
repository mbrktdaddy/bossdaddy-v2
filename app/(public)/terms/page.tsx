import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
 title: 'Terms of Use — Boss Daddy Life',
 description: 'The ground rules for using bossdaddylife.com — content ownership, acceptable use, liability, and your rights as a reader. Straight talk, not legalese.',
 openGraph: { title: 'Terms of Use — Boss Daddy Life', images: [{ url: '/api/og?title=Terms+of+Use&type=article', width: 1200, height: 630 }] },
 twitter: { card: 'summary_large_image' },
 alternates: { canonical: '/terms' },
}

const LAST_UPDATED = 'April 19, 2026'
const CONTACT_EMAIL = 'hello@bossdaddylife.com'

export default function TermsPage() {
 return (
 <div className="max-w-3xl mx-auto px-6 py-16">

 <h1 className="text-3xl font-black mb-2">Terms of Use</h1>
 <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

 <div className="prose prose-invert max-w-none
 prose-p:text-gray-400 prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-base prose-h3:mt-6
 prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
 prose-ul:text-gray-400 prose-li:my-1
 prose-strong:text-white">

 <p>
 These Terms of Use (&quot;Terms&quot;) govern your access to and use of{' '}
 <strong>bossdaddylife.com</strong> (the &quot;Site&quot;), operated by{' '}
 <strong>Boss Daddy LLC</strong>, an Illinois limited liability company, doing
 business as Boss Daddy Life (&quot;Boss Daddy LLC,&quot; &quot;we,&quot; &quot;us,&quot; or
 &quot;our&quot;). Using the Site means you agree to what&apos;s on this page. If you
 don&apos;t agree, don&apos;t use the Site. We&apos;ve kept the language as plain as we can.
 Where the law makes us use a specific term, we do.
 </p>

 <h2>1. Electronic Agreement</h2>
 <p>
 By accessing or using this Site — including by browsing, creating an account,
 posting content, or clicking any link — you are entering into a legally binding
 contract with Boss Daddy LLC. You agree that your electronic acceptance constitutes
 your signature and is as legally binding as a written signature, consistent with
 the <strong>Illinois Electronic Commerce Security Act (5 ILCS 175)</strong>.
 </p>
 <p>
 If you are entering into these Terms on behalf of a business or other legal entity,
 you represent that you have the authority to bind that entity to these Terms.
 </p>

 <h2>2. Eligibility</h2>
 <p>
 You must be at least 13 years old to use this Site. By using it, you confirm that
 you meet that requirement and that you have the legal capacity to enter into a
 binding contract. If you are under 18, you represent that a parent or legal guardian
 has reviewed and agreed to these Terms on your behalf.
 </p>

 <h2>3. Using the Site</h2>
 <p>You can use the Site for personal, non-commercial reading. Don&apos;t:</p>
 <ul>
 <li>Use it for anything illegal under federal, Illinois, or other applicable law</li>
 <li>Scrape, harvest, or bulk-extract content without our written permission</li>
 <li>Attempt to access, probe, or break into any part of the Site or its systems</li>
 <li>Post false, harmful, or deceptive content (spam, abuse, impersonation)</li>
 <li>Interfere with how the Site normally runs</li>
 <li>Use the Site to transmit unsolicited commercial communications</li>
 <li>Circumvent any security feature or access restriction</li>
 </ul>

 <h2>4. Accounts</h2>
 <p>
 To comment, like, save, or use member features, you need an account. You&apos;re
 responsible for:
 </p>
 <ul>
 <li>Keeping your login credentials secure and confidential</li>
 <li>All activity that occurs under your account</li>
 <li>Providing accurate and current information when you sign up</li>
 <li>Notifying us immediately of any unauthorized use of your account</li>
 </ul>
 <p>
 We can suspend or terminate accounts that violate these Terms, abuse the community,
 engage in fraudulent activity, or remain unused for an extended period. Account
 termination does not affect any rights or obligations that arose before termination.
 </p>

 <h2>5. Community Conduct</h2>
 <p>
 Boss Daddy Life is a hub for dads who show up every day. You&apos;re welcome here
 if you keep to these basics:
 </p>
 <ul>
 <li><strong>Respect others.</strong> Disagree, push back, argue your case — but do it like a man, not a troll. Personal attacks, slurs, and harassment get you removed.</li>
 <li><strong>Good faith only.</strong> Don&apos;t impersonate other users, the founder, or the brand. Don&apos;t spread things you know are false. Don&apos;t post bad-faith reviews meant to hurt a competitor or prop one up.</li>
 <li><strong>Stay on topic.</strong> This isn&apos;t the place for political warfare, religious arguments unrelated to the content, or self-promotion dressed up as a comment.</li>
 <li><strong>No gaming the community.</strong> No sock puppets, no vote manipulation, no coordinated brigading, no fake accounts.</li>
 <li><strong>No harm to minors.</strong> Content that endangers or exploits children will be removed and reported immediately. Zero tolerance.</li>
 <li><strong>Keep it legal.</strong> No threats, no illegal content, no doxxing, no stolen material, no content that violates the rights of others.</li>
 </ul>
 <p>
 We moderate in good faith, not by algorithm. If you think we got it wrong, email
 us — we&apos;ll hear you out.
 </p>

 <h2>6. Your Content</h2>
 <p>
 When you submit a comment or any other content to the Site, you grant Boss Daddy
 LLC a non-exclusive, royalty-free, perpetual, irrevocable, worldwide license to
 use, display, reproduce, and distribute that content on the Site and in connection
 with our services. You retain ownership of what you wrote.
 </p>
 <p>
 By submitting content, you represent and warrant that: (a) you own or have the
 right to submit that content; (b) the content does not infringe any third-party
 rights; and (c) the content complies with these Terms and all applicable laws.
 </p>
 <p>Don&apos;t submit content that is:</p>
 <ul>
 <li>Defamatory, harassing, threatening, or abusive</li>
 <li>Infringing on someone else&apos;s copyright, trademark, or privacy rights</li>
 <li>Spam, ads, or unsolicited promotional material</li>
 <li>False, misleading, or fraudulent</li>
 <li>In violation of any applicable federal, state, or local law</li>
 </ul>
 <p>
 Comments are moderated before publication. We reserve the right to remove any
 content at our discretion.
 </p>

 <h2>7. Our Content</h2>
 <p>
 Original content on this Site — reviews, articles, images, graphics, the Boss
 Daddy Life name and brand — belongs to or is licensed to Boss Daddy LLC and is
 protected by U.S. copyright, trademark, and other intellectual property laws.
 </p>
 <p>
 Linking to our content and quoting short excerpts with attribution is permitted.
 Republishing full reviews or articles without written permission is not. Nothing
 in these Terms grants you any right to use our trademarks, service marks, or
 trade names without prior written consent.
 </p>

 <h2>8. Affiliate Links and Commercial Relationships</h2>
 <p>
 This Site contains affiliate links. When you make a qualifying purchase through one,
 we earn a commission at no additional cost to you.{' '}
 <strong>Commissions do not influence our reviews or ratings.</strong> No sponsors.
 No paid placements. No sponsored ratings. For the full picture, read our{' '}
 <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>.
 </p>

 <h2>9. AI Content and Editorial Disclaimers</h2>
 <p>
 Some content on this Site has been drafted or researched with the help of AI tools.
 Every AI-assisted piece is reviewed and approved by a human before publication. AI
 does not substitute for lived experience, and ratings are always human-verified.
 Full details are in our <Link href="/editorial-standards">Editorial Standards</Link>.
 </p>
 <p>
 Product reviews and recommendations are honest opinions based on firsthand experience
 or direct knowledge. They are not professional advice — not medical, not financial,
 not legal, not anything else. Do your own research before you buy.
 </p>

 <h2>10. &quot;As Is&quot; Disclaimer</h2>
 <p>
 The Site and its content are provided <strong>&quot;as is&quot;</strong> and{' '}
 <strong>&quot;as available&quot;</strong> without warranties of any kind, express or
 implied, including but not limited to warranties of merchantability, fitness for a
 particular purpose, accuracy, or non-infringement. Boss Daddy LLC does not warrant
 that the Site will be uninterrupted, error-free, or free of viruses or other
 harmful components. Your use of the Site is at your own risk.
 </p>

 <h2>11. Limitation of Liability</h2>
 <p>
 To the fullest extent permitted by applicable law — including the{' '}
 <strong>Illinois Consumer Fraud and Deceptive Business Practices Act (815 ILCS 505)</strong>{' '}
 and other consumer protection statutes that cannot be waived — Boss Daddy LLC, its
 members, managers, employees, contractors, and agents are not liable for:
 </p>
 <ul>
 <li>Indirect, incidental, special, consequential, or punitive damages</li>
 <li>Loss of profits, data, goodwill, or business opportunities</li>
 <li>Damages arising from your reliance on content found on this Site</li>
 <li>Damages arising from your inability to access or use the Site</li>
 </ul>
 <p>
 Our total liability to you for any claim arising out of or relating to these Terms
 or the Site will not exceed the greater of (a) the amount you paid us in the twelve
 months preceding the claim, or (b) one hundred U.S. dollars ($100.00).
 </p>
 <p>
 Some states, including Illinois, do not allow certain limitations on implied
 warranties or exclusion of certain damages. To the extent those laws apply to you,
 some of the above limitations may not apply.
 </p>

 <h2>12. Indemnification</h2>
 <p>
 You agree to defend, indemnify, and hold harmless Boss Daddy LLC, its members,
 managers, employees, contractors, and agents from and against any claims, damages,
 losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees)
 arising out of or relating to:
 </p>
 <ul>
 <li>Your use of the Site in violation of these Terms</li>
 <li>Any content you submit to the Site</li>
 <li>Your violation of any applicable law or regulation</li>
 <li>Your violation of any third-party right, including intellectual property or privacy rights</li>
 </ul>
 <p>
 We reserve the right, at our expense, to assume exclusive defense and control of
 any matter subject to indemnification by you. You will cooperate with our defense
 of any such claim.
 </p>

 <h2>13. Third-Party Links</h2>
 <p>
 The Site links to third-party sites for your convenience. We do not endorse,
 control, or take responsibility for what happens on sites we don&apos;t operate.
 Those sites have their own terms and privacy policies — read them.
 </p>

 <h2>14. Privacy</h2>
 <p>
 Your use of the Site is also governed by our{' '}
 <Link href="/privacy-policy">Privacy Policy</Link>, incorporated into these Terms
 by reference. By using the Site, you consent to the data practices described in
 the Privacy Policy.
 </p>

 <h2>15. Dispute Resolution</h2>

 <h3>Informal Resolution First</h3>
 <p>
 Before filing any formal legal action, you agree to contact us at{' '}
 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and give us 30 days to
 resolve the issue informally. Most things can be handled this way.
 </p>

 <h3>Binding Arbitration</h3>
 <p>
 If informal resolution fails, any dispute, claim, or controversy arising out of
 or relating to these Terms or your use of the Site (excluding requests for
 injunctive or other equitable relief) will be resolved by binding arbitration
 under the rules of the American Arbitration Association (&quot;AAA&quot;), conducted
 in Illinois. The arbitration will be conducted in English. Judgment on the
 arbitration award may be entered in any court of competent jurisdiction in Illinois.
 This arbitration agreement is governed by the{' '}
 <strong>Illinois Uniform Arbitration Act (710 ILCS 5)</strong>.
 </p>

 <h3>Small Claims Exception</h3>
 <p>
 Either party may bring an individual claim in small claims court in Illinois for
 disputes within that court&apos;s jurisdiction, without first arbitrating.
 </p>

 <h3>Class Action Waiver</h3>
 <p>
 You agree to resolve disputes with Boss Daddy LLC only on an individual basis. You
 waive the right to participate in a class action, class arbitration, or representative
 proceeding. This waiver is a material condition of these Terms.
 </p>

 <h3>Opt-Out Right</h3>
 <p>
 You may opt out of the arbitration agreement by sending written notice to{' '}
 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> within 30 days of first
 accepting these Terms. Your opt-out will not affect any other provision of these
 Terms.
 </p>

 <h2>16. Governing Law and Venue</h2>
 <p>
 These Terms are governed by and construed in accordance with the laws of the{' '}
 <strong>State of Illinois</strong>, without regard to its conflict-of-law provisions.
 For any dispute not subject to arbitration, you consent to the exclusive personal
 jurisdiction and venue of the state and federal courts located in the State of
 Illinois.
 </p>

 <h2>17. Severability</h2>
 <p>
 If any provision of these Terms is found to be invalid, illegal, or unenforceable
 by a court of competent jurisdiction, that provision will be enforced to the maximum
 extent permissible and the remaining provisions will continue in full force and effect.
 </p>

 <h2>18. Entire Agreement</h2>
 <p>
 These Terms, together with our <Link href="/privacy-policy">Privacy Policy</Link>{' '}
 and <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>, constitute the
 entire agreement between you and Boss Daddy LLC regarding your use of the Site and
 supersede all prior agreements, representations, or understandings relating to that
 subject matter.
 </p>

 <h2>19. No Waiver</h2>
 <p>
 Our failure to enforce any provision of these Terms at any time does not constitute
 a waiver of that provision or our right to enforce it in the future.
 </p>

 <h2>20. Changes to These Terms</h2>
 <p>
 We may update these Terms at any time. Changes take effect when posted here with
 an updated &quot;Last updated&quot; date. Your continued use of the Site after an update
 constitutes your acceptance of the revised Terms. If changes are material, we will
 make reasonable efforts to notify you (for example, by email or a notice on the Site).
 </p>

 <h2>21. Contact</h2>
 <p>
 Questions about these Terms?{' '}
 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
 </p>
 <p>
 Boss Daddy LLC<br />
 State of Illinois<br />
 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
 </p>

 </div>

 <div className="mt-10 pt-8 flex items-center gap-6 flex-wrap text-sm">
 <Link href="/editorial-standards" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Editorial Standards
 </Link>
 <Link href="/affiliate-disclosure" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Affiliate Disclosure
 </Link>
 <Link href="/privacy-policy" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Privacy Policy
 </Link>
 </div>

 </div>
 )
}
