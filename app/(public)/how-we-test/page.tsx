import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
 title: 'How We Test — Boss Daddy Life',
 description: 'Real products, real testing, real dads. Here\'s exactly how Boss Daddy Life reviews stuff and earns the Boss Daddy Approved designation.',
 alternates: { canonical: '/how-we-test' },
}

const ICON_CLS = 'w-7 h-7 text-accent-text'

// Outlined Heroicons-style SVGs per the no-emoji-on-web brand rule.
const PILLAR_TESTING: { icon: React.ReactNode; title: string; description: string }[] = [
 {
 icon: (
   <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
     <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003.001 2.48z" />
     <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
   </svg>
 ),
 title: 'Cooking & Grilling',
 description:
 'We cook on it. Multiple sessions, multiple proteins, across weekends. A grill gets low-and-slow ribs, a screaming-hot steak sear, and a weeknight burger rush with kids yelling for dinner. We watch heat zones, how it handles flare-ups, how the grates season in, and how clean-up goes at 9 p.m. when you\'re tired. One cook tells you nothing. Three weekends starts to tell the truth.',
 },
 {
 icon: (
   <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
     <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
   </svg>
 ),
 title: 'Tools & DIY / Home Improvement',
 description:
 'No demo cuts. No showroom runs. Tools go on real projects — deck boards, framing, trim, car repair, fence posts. We note battery life under load, how the tool balances after an hour, whether the chuck holds, whether the case survives a toolbox. If a drill can\'t hang on a full Saturday of work, the review says so.',
 },
 {
 icon: (
   <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
     <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m-9-12h17.25m-1.5-3.75H4.5m16.5 0V21" />
   </svg>
 ),
 title: 'Outdoors & Adventure',
 description:
 'Tested in the weather, not the forecast. Coolers get loaded and left in the sun. Packs get hauled. Tents get pitched in wind and rain. Knives get used for real camp work, not paper cuts. We report what failed, what held, and what we\'d actually take with us next time — including with a kid in tow, because that changes the calculation.',
 },
 {
 icon: (
   <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
     <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
   </svg>
 ),
 title: 'Health & Fitness',
 description:
 'Supplements and stuff get weeks, not days. A pre-workout gets a full training cycle. A protein powder gets mixed in every drink style a real guy uses — shaker, blender, oatmeal, coffee. Equipment gets used in home-gym reality: concrete floors, limited space, interruptions. Outcomes are reported honestly, including the ones that didn\'t move the needle.',
 },
 {
 icon: (
   <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
     <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
   </svg>
 ),
 title: 'Kid Gear & Baby Gear',
 description:
 'Used by an actual kid, in the actual chaos. Strollers go over curbs, gravel, and airport tile. Car seats get installed and re-installed. Monitors run overnight, every night. Toys survive — or don\'t survive — a real toddler. If it can\'t take a blowout, a tantrum, and a dropped bottle, that\'s in the review. Safety-critical stuff is checked against current standards before it ever gets written up.',
 },
 {
 icon: (
   <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
     <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
   </svg>
 ),
 title: 'Dad Life & Fatherhood Culture',
 description:
 'Books, stuff, wallets, watches, EDC, gifts — things dads actually carry and use. We live with them. A wallet rides in the back pocket for a month. A watch goes in the shower, the gym, the job site. A book gets read cover-to-cover before we write a word about it. No skim-and-summarize.',
 },
 {
 icon: (
   <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
     <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
   </svg>
 ),
 title: 'Family Living & Lifestyle',
 description:
 'Home goods, family tech, organization, routines, and the stuff that makes a house run. Tested in the actual house — with a wife, a baby, a dog, a garage full of projects. If a product promises to simplify something and makes it harder, we say so. Nothing here gets a pass for looking nice on Instagram.',
 },
]

export default function HowWeTestPage() {
 return (
 <div className="max-w-3xl mx-auto px-6 py-16">

 <h1 className="text-3xl font-black mb-2 text-prose">How We Test</h1>
 <p className="text-prose-faint text-sm mb-10">
 Real products. Real testing. Real dads. No lab coats, no paid placements, no shortcuts.
 </p>

 <div className="prose prose-orange max-w-none
 prose-p:text-prose-muted prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-prose prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-prose prose-h3:text-lg prose-h3:mt-8
 prose-a:text-accent-text-soft prose-a:no-underline hover:prose-a:text-accent
 prose-strong:text-prose
 prose-ul:text-prose-muted prose-li:my-1">

 <h2>Our Philosophy</h2>
 <p>
 There&apos;s no sterile lab at Boss Daddy Life. No climate-controlled chamber. No
 spec-sheet theater. The backyard is the lab. The garage is the lab. The living room
 floor at 6 a.m. with a baby on one hip is the lab. The job site is the lab.
 </p>
 <p>
 We test the way dads actually use this stuff — on a tight schedule, with kids
 underfoot, on a budget that matters, with projects that need to work the first time.
 If a product can&apos;t hold up to a regular guy doing regular dad things, it doesn&apos;t
 matter how well it performed in somebody else&apos;s spec video.
 </p>

 <h2>Who Does the Testing</h2>
 <p>
 The founder — a 46-year-old first-time dad with a background in construction,
 automotive work, nutrition, fitness, and towboat captaining — tests every product he
 personally reviews. Hands on it. In the real world. Not from a desk.
 </p>
 <p>
 Our human editors and contributors are held to the same bar. If they&apos;re writing an
 editorial review, they&apos;ve used the product or have direct firsthand knowledge of it.
 That&apos;s not a nice-to-have. It&apos;s the rule. <strong>No gifted-product editorial
 reviews. Not for the founder, not for anybody on the team.</strong>
 </p>

 <h2>How Products Get Selected</h2>
 <p>
 We cover what dads actually buy, use, and ask about — and we only review products
 we&apos;ve personally purchased or have direct firsthand knowledge of. The full eligibility
 rules are in our <Link href="/editorial-standards">Editorial Standards</Link>.
 </p>

 <h2>The Testing Process</h2>
 <p>Across every category, the same principles hold:</p>
 <ul>
 <li><strong>Extended use.</strong> Not a ten-minute unbox and a hot take. Products live with us long enough to reveal what they actually are.</li>
 <li><strong>Real conditions.</strong> Weather. Wear. Kids. Pressure. Time crunch. The conditions a spec sheet can&apos;t simulate.</li>
 <li><strong>Failure points, not just first impressions.</strong> What broke, what wore down, what got annoying on day thirty — that&apos;s in the review. So is what held up.</li>
 <li><strong>Honest comparisons.</strong> We benchmark against alternatives we&apos;ve used or have firsthand knowledge of — not a list we pulled off a search result.</li>
 <li><strong>Updates when the story changes.</strong> A product changes, a recall drops, new use reveals a problem — we go back and update. Reviews aren&apos;t a snapshot; they&apos;re a living record.</li>
 </ul>

 <h2>What Testing Looks Like in Each Category</h2>
 <p>
 Each of our seven pillars has its own version of &quot;real-world testing.&quot; Here&apos;s
 what that means in practice:
 </p>

 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose mb-12">
 {PILLAR_TESTING.map(({ icon, title, description }) => (
 <div key={title} className="bg-surface rounded-2xl p-5">
 <div className="mb-3">{icon}</div>
 <h3 className="font-bold text-card-title text-base mb-2">{title}</h3>
 <p className="text-prose-faint text-sm leading-relaxed">{description}</p>
 </div>
 ))}
 </div>

 <div className="prose prose-orange max-w-none
 prose-p:text-prose-muted prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-prose prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-prose prose-h3:text-lg prose-h3:mt-8
 prose-a:text-accent-text-soft prose-a:no-underline hover:prose-a:text-accent
 prose-strong:text-prose
 prose-ul:text-prose-muted prose-li:my-1">

 <h2>The Rating System</h2>
 <p>
 We rate on a <strong>1 to 10 scale</strong>, in half-point increments. Simple on
 purpose. A 10 is rare — reserved for stuff that genuinely earned it across every
 dimension. An 8 or above earns the Boss Daddy Approved designation. A 5 is honest:
 it works, it&apos;s fine, it might not be the one we&apos;d buy again. Anything below a 5
 is a product we&apos;re telling you to think twice about.
 </p>
 <p>Every rating weighs five things:</p>
 <ul>
 <li><strong>Performance.</strong> Does it do what it claims under real conditions?</li>
 <li><strong>Value.</strong> At the price it sells for, is it a smart buy? Not &quot;cheapest&quot; — smart.</li>
 <li><strong>Durability.</strong> Will it still be working in a year? Five?</li>
 <li><strong>Ease of use.</strong> Can a regular dad get the benefit without an instruction manual and a YouTube rabbit hole?</li>
 <li><strong>Real-world reliability.</strong> Does it hold up when the conditions aren&apos;t perfect — because they never are?</li>
 </ul>
 <p>
 <strong>Ratings are set by humans.</strong> Not AI. Not an algorithm. A person who
 has used the product makes the call and signs their name to it. A product can check
 every spec-sheet box and still rate poorly if it fails when it counts. That&apos;s the
 whole point.
 </p>

 </div>

 <div className="not-prose bg-gradient-to-br from-accent-tint to-white rounded-2xl p-6 mb-12">
 <div className="text-xs uppercase tracking-widest text-eyebrow font-bold mb-2">
 The Highest Designation
 </div>
 <h2 className="text-3xl font-black text-prose mb-4">Boss Daddy Approved</h2>
 <p className="text-prose-muted leading-relaxed mb-4">
 <strong className="text-prose">Boss Daddy Approved</strong> is the top designation on
 this site. It&apos;s not a sticker we slap on anything we want to sell. It&apos;s earned.
 </p>
 <p className="text-prose-muted leading-relaxed mb-4">
 To earn it, a product has to hold up over time, deliver on everything it claims, and
 be something we&apos;d put our own money down for again — today, tomorrow, a year from
 now. One good weekend doesn&apos;t earn the badge. Neither does a spec sheet.
 </p>
 <p className="text-prose-muted leading-relaxed mb-4">
 Most products we review <strong className="text-prose">don&apos;t</strong> earn it. That&apos;s
 on purpose. If everything were Boss Daddy Approved, the badge would mean nothing.
 </p>
 <p className="text-prose-muted leading-relaxed">
 Commission rate, brand size, marketing budget, relationship with the company —{' '}
 <strong className="text-prose">zero influence</strong>. A brand paying more doesn&apos;t
 move their product up the list. A brand paying less doesn&apos;t keep a great product
 off it. The badge is earned in use, by a human, or it isn&apos;t earned.
 </p>
 </div>

 <div className="prose prose-orange max-w-none
 prose-p:text-prose-muted prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-prose prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-prose prose-h3:text-lg prose-h3:mt-8
 prose-a:text-accent-text-soft prose-a:no-underline hover:prose-a:text-accent
 prose-strong:text-prose
 prose-ul:text-prose-muted prose-li:my-1">

 <h2>AI&apos;s Role — and Its Limits</h2>
 <p>
 We use Anthropic&apos;s Claude as a tool. We&apos;re telling you straight out because that&apos;s
 the honest thing to do, and because we&apos;re proud of how we use it — not embarrassed
 by it.
 </p>
 <p><strong>What AI does at Boss Daddy Life:</strong></p>
 <ul>
 <li>Drafts review structure and first-pass copy</li>
 <li>Researches specs, comparisons, and competitor data</li>
 <li>Surfaces relevant context and background</li>
 <li>Helps turn messy testing notes into readable prose</li>
 </ul>
 <p><strong>What AI does not do — ever:</strong></p>
 <ul>
 <li>Handle the product</li>
 <li>Form an opinion from actually using something</li>
 <li>Set ratings</li>
 <li>Decide what earns Boss Daddy Approved</li>
 <li>Publish anything without a human approving it</li>
 </ul>
 <p>
 Every rating, every verdict, every Boss Daddy Approved call is made by a human who
 has used the product. The AI is a writing tool. It is not a reviewer. Full stop.
 </p>
 <p>
 For the full AI usage policy, see our <Link href="/editorial-standards">Editorial Standards</Link>.
 </p>

 <h2>The Bottom Line</h2>
 <p>
 Real products. Real testing. Real dads. Ratings set by humans who have used the
 thing. Boss Daddy Approved earned, not awarded. AI used as a writing tool, never as
 a judge. Reviews updated when the story changes — every update dated and noted,
 no quiet edits.
 </p>
 <p>
 That&apos;s the whole process. If anything on this site ever falls short of it, tell us.
 We&apos;ll answer straight.
 </p>

 </div>

 <div className="mt-10 pt-8 flex items-center gap-6 flex-wrap text-sm">
 <Link href="/editorial-standards" className="py-2 inline-block text-prose-faint hover:text-prose-muted transition-colors">
 Editorial Standards
 </Link>
 <Link href="/affiliate-disclosure" className="py-2 inline-block text-prose-faint hover:text-prose-muted transition-colors">
 Affiliate Disclosure
 </Link>
 <Link href="/about" className="py-2 inline-block text-prose-faint hover:text-prose-muted transition-colors">
 About
 </Link>
 </div>

 </div>
 )
}
