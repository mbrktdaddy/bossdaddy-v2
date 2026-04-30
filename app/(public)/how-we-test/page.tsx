import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
 title: 'How We Test — Boss Daddy Life',
 description: 'Real products, real testing, real dads. Here\'s exactly how Boss Daddy Life reviews gear and earns the Boss Daddy Approved designation.',
 alternates: { canonical: '/how-we-test' },
}

const PILLAR_TESTING = [
 {
 icon: '🔥',
 title: 'Cooking & Grilling',
 description:
 'We cook on it. Multiple sessions, multiple proteins, across weekends. A grill gets low-and-slow ribs, a screaming-hot steak sear, and a weeknight burger rush with kids yelling for dinner. We watch heat zones, how it handles flare-ups, how the grates season in, and how clean-up goes at 9 p.m. when you\'re tired. One cook tells you nothing. Three weekends starts to tell the truth.',
 },
 {
 icon: '🔧',
 title: 'Tools & DIY / Home Improvement',
 description:
 'No demo cuts. No showroom runs. Tools go on real projects — deck boards, framing, trim, car repair, fence posts. We note battery life under load, how the tool balances after an hour, whether the chuck holds, whether the case survives a toolbox. If a drill can\'t hang on a full Saturday of work, the review says so.',
 },
 {
 icon: '🏕️',
 title: 'Outdoors & Adventure',
 description:
 'Tested in the weather, not the forecast. Coolers get loaded and left in the sun. Packs get hauled. Tents get pitched in wind and rain. Knives get used for real camp work, not paper cuts. We report what failed, what held, and what we\'d actually take with us next time — including with a kid in tow, because that changes the calculation.',
 },
 {
 icon: '💪',
 title: 'Health & Fitness',
 description:
 'Supplements and gear get weeks, not days. A pre-workout gets a full training cycle. A protein powder gets mixed in every drink style a real guy uses — shaker, blender, oatmeal, coffee. Equipment gets used in home-gym reality: concrete floors, limited space, interruptions. Outcomes are reported honestly, including the ones that didn\'t move the needle.',
 },
 {
 icon: '👶',
 title: 'Kid Gear & Baby Gear',
 description:
 'Used by an actual kid, in the actual chaos. Strollers go over curbs, gravel, and airport tile. Car seats get installed and re-installed. Monitors run overnight, every night. Toys survive — or don\'t survive — a real toddler. If it can\'t take a blowout, a tantrum, and a dropped bottle, that\'s in the review. Safety-critical gear is checked against current standards before it ever gets written up.',
 },
 {
 icon: '🧔',
 title: 'Dad Life & Fatherhood Culture',
 description:
 'Books, gear, wallets, watches, EDC, gifts — things dads actually carry and use. We live with them. A wallet rides in the back pocket for a month. A watch goes in the shower, the gym, the job site. A book gets read cover-to-cover before we write a word about it. No skim-and-summarize.',
 },
 {
 icon: '🏡',
 title: 'Family Living & Lifestyle',
 description:
 'Home goods, family tech, organization, routines, and the stuff that makes a house run. Tested in the actual house — with a wife, a baby, a dog, a garage full of projects. If a product promises to simplify something and makes it harder, we say so. Nothing here gets a pass for looking nice on Instagram.',
 },
]

export default function HowWeTestPage() {
 return (
 <div className="max-w-3xl mx-auto px-6 py-16">

 <h1 className="text-3xl font-black mb-2 text-white">How We Test</h1>
 <p className="text-gray-500 text-sm mb-10">
 Real products. Real testing. Real dads. No lab coats, no paid placements, no shortcuts.
 </p>

 <div className="prose prose-invert prose-orange max-w-none
 prose-p:text-gray-400 prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-lg prose-h3:mt-8
 prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
 prose-strong:text-white
 prose-ul:text-gray-400 prose-li:my-1">

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
 <div key={title} className="bg-gray-900 rounded-2xl p-5">
 <div className="text-2xl mb-3">{icon}</div>
 <h3 className="font-bold text-orange-500 text-base mb-2">{title}</h3>
 <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
 </div>
 ))}
 </div>

 <div className="prose prose-invert prose-orange max-w-none
 prose-p:text-gray-400 prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-lg prose-h3:mt-8
 prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
 prose-strong:text-white
 prose-ul:text-gray-400 prose-li:my-1">

 <h2>The Rating System</h2>
 <p>
 We rate on a <strong>1 to 10 scale</strong>, in half-point increments. Simple on
 purpose. A 10 is rare — reserved for gear that genuinely earned it across every
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

 <div className="not-prose bg-gradient-to-br from-orange-950/40 to-gray-900 rounded-2xl p-6 mb-12">
 <div className="text-xs uppercase tracking-widest text-orange-500 font-bold mb-2">
 The Highest Designation
 </div>
 <h2 className="text-3xl font-black text-white mb-4">Boss Daddy Approved</h2>
 <p className="text-gray-300 leading-relaxed mb-4">
 <strong className="text-white">Boss Daddy Approved</strong> is the top designation on
 this site. It&apos;s not a sticker we slap on anything we want to sell. It&apos;s earned.
 </p>
 <p className="text-gray-400 leading-relaxed mb-4">
 To earn it, a product has to hold up over time, deliver on everything it claims, and
 be something we&apos;d put our own money down for again — today, tomorrow, a year from
 now. One good weekend doesn&apos;t earn the badge. Neither does a spec sheet.
 </p>
 <p className="text-gray-400 leading-relaxed mb-4">
 Most products we review <strong className="text-white">don&apos;t</strong> earn it. That&apos;s
 on purpose. If everything were Boss Daddy Approved, the badge would mean nothing.
 </p>
 <p className="text-gray-400 leading-relaxed">
 Commission rate, brand size, marketing budget, relationship with the company —{' '}
 <strong className="text-white">zero influence</strong>. A brand paying more doesn&apos;t
 move their product up the list. A brand paying less doesn&apos;t keep a great product
 off it. The badge is earned in use, by a human, or it isn&apos;t earned.
 </p>
 </div>

 <div className="prose prose-invert prose-orange max-w-none
 prose-p:text-gray-400 prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-white prose-h2:text-xl prose-h2:mt-10
 prose-h3:font-bold prose-h3:text-gray-200 prose-h3:text-lg prose-h3:mt-8
 prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
 prose-strong:text-white
 prose-ul:text-gray-400 prose-li:my-1">

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
 <Link href="/editorial-standards" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Editorial Standards
 </Link>
 <Link href="/affiliate-disclosure" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 Affiliate Disclosure
 </Link>
 <Link href="/about" className="py-2 inline-block text-gray-500 hover:text-gray-400 transition-colors">
 About
 </Link>
 </div>

 </div>
 )
}
