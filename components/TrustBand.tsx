interface Stat {
  num: string
  label: string
  sub: string
}

const STATS: Stat[] = [
  { num: 'Zero',  label: 'Paid placements',        sub: 'No one buys a positive verdict here' },
  { num: 'Zero',  label: 'Sponsored posts',        sub: 'Ads and editorial stay separate' },
  { num: '100%',  label: 'Editorial independence', sub: 'Manufacturer samples get the same treatment' },
]

export default function TrustBand() {
  return (
    <section className="bg-surface-raised border-t-[3px] border-t-accent border-b border-b-soft">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-strong">
        {STATS.map((s) => (
          <div key={s.label} className="px-2 md:px-8 py-5 md:py-0 text-center">
            <div
              className="text-5xl font-black text-white leading-none"
              style={{ letterSpacing: s.num === '100%' ? '-1px' : '-0.5px' }}
            >
              {s.num}
            </div>
            <div className="mt-3 text-sm font-extrabold text-white tracking-tight">
              {s.label}
            </div>
            <div className="mt-1 text-[11px] text-zinc-400">
              {s.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
