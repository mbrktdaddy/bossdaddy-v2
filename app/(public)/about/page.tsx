import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — Boss Daddy Life',
  description: 'The dad behind Boss Daddy Life. Real reviews, zero corporate influence.',
}

const PILLARS = [
  {
    icon: '🔥',
    title: 'BBQ & Grilling',
    description: 'From offset smokers to weekend grills — tested in the backyard, not a lab.',
  },
  {
    icon: '🔧',
    title: 'DIY & Tools',
    description: 'Power tools, hand tools, and garage gear that actually holds up.',
  },
  {
    icon: '👶',
    title: 'Kids & Family',
    description: 'Gear for the whole crew. Strollers, toys, and everything in between.',
  },
  {
    icon: '💪',
    title: 'Health & Fitness',
    description: 'Supplements, equipment, and routines for dads who refuse to slow down.',
  },
]

const STATS = [
  { value: '20+', label: 'Products reviewed' },
  { value: '15+', label: 'Articles written' },
  { value: '100%', label: 'Self-purchased' },
  { value: '$0', label: 'Paid placements' },
]

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">

      {/* Hero */}
      <div className="mb-16">
        <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          The story behind Boss Daddy
        </div>
        <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
          Just a Dad Who Buys the Stuff,
          <br />
          <span className="text-orange-500">Tests It, and Tells the Truth.</span>
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
          Boss Daddy Life started because I was tired of reading reviews written by people who&apos;d
          never actually used the product. I buy everything myself, use it in real life with my
          family, and give you the honest take — no brand deals, no sponsored posts, no BS.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {STATS.map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
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
        <h2>Why Boss Daddy?</h2>
        <p>
          Being a dad means your time and money are always on the line. A bad tool purchase
          means a weekend project that doesn&apos;t get finished. A bad supplement means wasted
          money and no results. A bad baby product means frustrated kids and stressed parents.
        </p>
        <p>
          I started this site to cut through the noise. Every product I review I&apos;ve personally
          purchased and used — often for months before writing about it. I don&apos;t accept free
          products in exchange for reviews, and I don&apos;t take paid placements. If I recommend
          something, it&apos;s because I actually think you should buy it.
        </p>
        <h2>What You&apos;ll Find Here</h2>
        <p>
          In-depth product reviews, buying guides, and how-to articles across the four categories
          I care most about as a dad: BBQ & grilling, DIY & tools, kids & family gear, and
          health & fitness. Real testing, honest ratings, clear verdicts.
        </p>
      </div>

      {/* Pillars */}
      <div className="mb-16">
        <h2 className="text-2xl font-black mb-6">What I Cover</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="text-3xl mb-3">{p.icon}</div>
              <h3 className="font-bold text-base mb-2 text-white">{p.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 border border-orange-800/30 rounded-3xl px-8 py-10 text-center">
        <h2 className="text-2xl font-black mb-3">Ready to Find Your Next Gear?</h2>
        <p className="text-gray-400 mb-6">Browse all reviews or jump into a category.</p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/reviews" className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors">
            Browse Reviews
          </Link>
          <Link href="/articles" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition-colors">
            Read Articles
          </Link>
        </div>
      </div>

    </div>
  )
}
