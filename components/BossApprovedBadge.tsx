interface Props {
  size?: 'sm' | 'lg'
}

export default function BossApprovedBadge({ size = 'sm' }: Props) {
  if (size === 'lg') {
    return (
      <div className="inline-flex flex-col items-center border-2 border-orange-600 rounded px-3 py-2 bg-orange-950/40 rotate-[-2deg] shrink-0">
        <span className="text-[10px] font-black text-orange-500 tracking-[0.18em] uppercase leading-none">Boss Daddy</span>
        <span className="text-orange-400 text-sm leading-none my-1">✓</span>
        <span className="text-[10px] font-black text-orange-500 tracking-[0.18em] uppercase leading-none">Approved</span>
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col items-center border border-orange-600/80 rounded px-1.5 py-1 bg-orange-950/50 rotate-[-2deg] shrink-0">
      <span className="text-[7px] font-black text-orange-500 tracking-[0.15em] uppercase leading-none">Boss Daddy</span>
      <span className="text-orange-400 text-[10px] leading-none my-0.5">✓</span>
      <span className="text-[7px] font-black text-orange-500 tracking-[0.15em] uppercase leading-none">Approved</span>
    </div>
  )
}
