import type { Metadata } from 'next'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 3600

export const metadata: Metadata = {
 title: 'About — Boss Daddy Life',
 description: 'The real story behind Boss Daddy Life. A first-time dad on a mission to be the best version of himself — and help other dads do the same.',
 alternates: { canonical: '/about' },
}

export default async function AboutPage() {
 const supabase = await createClient()

 const [{ count: reviewCount }, { count: articleCount }] = await Promise.all([
 supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_visible', true),
 supabase.from('guides').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_visible', true),
 ])

 const STATS = [
 { value: String(reviewCount ?? 0), label: 'Products reviewed' },
 { value: String(articleCount ?? 0), label: 'Articles written' },
 { value: '100%', label: 'Firsthand tested' },
 { value: '$0', label: 'Paid placements' },
 ]

 return (
 <div className="max-w-4xl mx-auto px-6 py-16">

 {/* Hero */}
 <div className="mb-16">
 <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-6">
 <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
 The real story behind Boss Daddy
 </div>
 <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
 The Dad Who Thought
 <br />
 <span className="text-orange-500">He&apos;d Never Be One.</span>
 </h1>
 <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
 After separating from my ex-wife of 13 years — who was unable to have children — and
 being 46 years old, I had accepted that having kids probably wasn&apos;t in the cards for me.
 After a rough couple of years and some serious soul-searching, I became dead serious about
 making changes. I found something I hadn&apos;t had in a very long time: faith.
 </p>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
 {STATS.map((s) => (
 <div key={s.label} className="bg-gray-900 rounded-2xl p-5 text-center">
 <p className="text-3xl font-black text-orange-500 mb-1">{s.value}</p>
 <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
 </div>
 ))}
 </div>

 {/* Story */}
 <div className="prose prose-invert prose-orange max-w-none mb-16
 prose-p:text-gray-400 prose-p:leading-relaxed
 prose-h2:font-black prose-h2:text-white prose-h2:text-2xl
 prose-strong:text-white">

 <p>
 What I didn&apos;t know at the time was that finding faith and doing some serious work on
 myself would lead me to the most amazing woman, best friend, and mother of my first baby girl.
 </p>
 <p>
 One day the thought of being a dad was nonexistent — and the next, I was holding a tiny
 human who looked up at me like I was the whole damn world. In that moment, everything
 shifted. I went from &quot;probably never&quot; to &quot;this is everything&quot; in a single heartbeat.
 </p>
 <p>
 Every single day since, I&apos;ve made a non-negotiable commitment: show up, get better, and
 never settle. I pray. I grind. I work on being the best husband and father my family
 deserves. That&apos;s what Boss Daddy means to me. It&apos;s not a cute title. It&apos;s a standard.
 A daily decision to be strong, present, and proud — exactly the kind of man my daughter
 deserves to look up to.
 </p>
 <p>
 As a guy who was always a do-it-yourselfer with experience across construction, working on
 cars, nutrition, fitness, and even captaining a towboat — with a deep love for building
 things from the ground up with my own hands — I decided to build something of my own.
 Why not create a hub for dads who love being a dad and show up every day ready to dad
 like a boss?
 </p>
 <p>
 That&apos;s where Boss Daddy was born — not in some boardroom, but in the middle of real life,
 real struggle, and real redemption.
 </p>

 <h2>Why I Built This Site</h2>
 <p>
 Being a dad means your time and your money are sacred. A crappy tool turns a weekend
 project into frustration. A weak grill ruins the backyard memories. A baby product that
 fails at 2 a.m. steals sleep from the whole house.
 </p>
 <p>
 I got tired of the fluff, the fake reviews, and the brand-sponsored noise. So I built
 Boss Daddy as the place where real dads can go for reviews, articles, and gear from a
 real dad in the trenches — no fluff, no paid placements, no compromises.
 </p>
 <p>
 Every single product I review I&apos;ve bought with my own money, tested with my own hands,
 or have firsthand knowledge of. I don&apos;t have sponsors. I don&apos;t run paid placements. If I
 tell you to buy it, it&apos;s because it earned that Boss Daddy Approved recommendation in my
 own backyard, garage, and living room.
 </p>

 <h2>Real Dad. Smart Tools.</h2>
 <p>
 We are still a founder-led operation — buying the gear, testing it in our own backyards,
 sweating through the projects, and living the dad life every single day. But to deliver
 the most comprehensive, up-to-date, and useful information possible, we also put AI to
 work for you. We use advanced AI analysis, research models, and tools to dig through
 specs, compare data, and surface the latest testing results — to create the most
 comprehensive reviews, articles, and guides on the internet.
 </p>
 <p>
 Every article, every review, and every recommendation still gets personally approved by
 the Boss Daddy team. Whether you&apos;re shopping for a new grill, hunting for kid gear,
 buying a new tool, or just looking for guidance on a home improvement project — Boss
 Daddy uses every tool available to make sure you get straight answers from guys who
 actually show up. That&apos;s the Boss Daddy way: real dads + smart tech = better decisions
 for your family.
 </p>

 <h2>More Than Just Reviews</h2>
 <p>
 Boss Daddy started as a review and gear site, but quickly became something much bigger —
 an AI-assisted gear and product review powerhouse, a place for honest advice, practical
 skills, and epic family adventures, and a family-oriented brand that stands for
 brotherhood, strength, honesty, and faith.
 </p>
 <p>
 Whether you&apos;re a brand-new dad figuring out that first diaper change, a seasoned dad
 leveling up your backyard, or a guy who just wants content from someone who actually
 gets it — you&apos;re home.
 </p>
 </div>

 {/* Pillars */}
 <div className="mb-16">
 <h2 className="text-2xl font-black mb-2">What We Cover</h2>
 <p className="text-gray-500 text-sm mb-6">Real-world testing across everything modern dads actually love.</p>
 {/* Mobile: break out of parent padding, full-width scroll */}
 <div className="-mx-6 overflow-x-auto scrollbar-hide sm:hidden">
 <div className="flex gap-3 px-6 pb-2">
 {CATEGORIES.map((cat) => (
 <Link
 key={cat.slug}
 href={`/reviews?category=${cat.slug}`}
 className={`group shrink-0 w-28 flex flex-col items-center justify-center rounded-2xl border ${cat.border} bg-gradient-to-br ${cat.color} hover:scale-[1.03] transition-transform duration-200 py-6 px-2`}
 >
 <div className="text-4xl mb-3">{cat.icon}</div>
 <p className={`text-xs font-bold text-center leading-snug ${cat.accent}`}>{cat.label}</p>
 </Link>
 ))}
 </div>
 </div>
 {/* Desktop: full grid */}
 <div className="hidden sm:grid sm:grid-cols-7 gap-3">
 {CATEGORIES.map((cat) => (
 <Link
 key={cat.slug}
 href={`/reviews?category=${cat.slug}`}
 className={`group flex flex-col items-center justify-center rounded-2xl border ${cat.border} bg-gradient-to-br ${cat.color} hover:scale-[1.03] transition-transform duration-200 py-6 px-2`}
 >
 <div className="text-4xl mb-3">{cat.icon}</div>
 <p className={`text-xs font-bold text-center leading-snug ${cat.accent}`}>{cat.label}</p>
 </Link>
 ))}
 </div>
 </div>

 {/* CTA + Newsletter */}
 <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 rounded-2xl px-8 py-10 text-center">
 <h2 className="text-2xl font-black mb-3">Built for Dads Who Show Up.</h2>
 <p className="text-gray-400 mb-2">
 This isn&apos;t just another review site. This is Boss Daddy — a resource, a community, and
 a brand for every man who&apos;s decided that being a Boss Dad isn&apos;t a compromise of his
 strength… it&apos;s the ultimate expression of it.
 </p>
 <p className="text-gray-500 text-sm mb-8">
 Welcome to the Boss Daddy crew. Now let&apos;s dad like a boss — together.
 </p>

 {/* Newsletter signup */}
 <div className="mb-8">
 <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Join the Crew</p>
 <p className="text-gray-400 text-sm mb-4">
 Weekly gear picks, honest reviews, and dad-life wins. No spam. No sponsors. Just the crew.
 </p>
 <form action="/api/newsletter/subscribe" method="POST" className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
 <input
 type="email"
 name="email"
 required
 placeholder="your@email.com"
 className="flex-1 px-4 py-3 bg-gray-900 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
 />
 <button
 type="submit"
 className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl transition-colors text-sm whitespace-nowrap"
 >
 Join Free
 </button>
 </form>
 <p className="text-xs text-gray-600 mt-3">Unsubscribe anytime. We mean it.</p>
 </div>

 <div className="pt-6 flex items-center justify-center gap-4 flex-wrap">
 <Link href="/reviews" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-2xl transition-colors text-sm">
 Browse Reviews
 </Link>
 <Link href="/guides" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-2xl transition-colors text-sm">
 Read Articles
 </Link>
 </div>
 </div>

 </div>
 )
}
