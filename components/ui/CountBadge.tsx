// Unread / quantity markers. Six count dots were hand-rolled (rounded-full
// pills at 9px, 10px, 11px; "9+" here, "99+" there).
//
// <CountBadge> — the square orange stamp: Montserrat black 10px, tabular, white
// ink. White on orange is right HERE (a chip-class numeral, brand-guide §2
// "Blocks"); it's body text on orange that fails AA. The caller positions it
// (`absolute -top-0.5 -right-0.5` on an IconButton). Renders nothing at 0.
// aria-hidden: put the count in the control's own label ("Cart, 3 items") —
// a bare "3" read out after the label means nothing.
//
// `tone="muted"` — a count that's information, not an alert (a muted thread):
// the same geometry on the recessed surface, so it never reads as a call.
//
// <UnreadDot> — the 8px round marker on list rows. ALWAYS mounted, transparent
// when read: mounting it on unread shifted the row's text 16px sideways the
// moment it was marked read (state never changes geometry, brand-guide §2).

export function CountBadge({ count, max = 99, tone = 'accent', className = '' }: { count: number; max?: number; tone?: 'accent' | 'muted'; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-sm ${tone === 'muted' ? 'bg-surface-sunken text-prose-muted' : 'bg-accent text-white'} font-display font-black text-[10px] tabular-nums leading-none ${className}`}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}

export function UnreadDot({ unread, className = '' }: { unread: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-2 h-2 shrink-0 rounded-full transition-colors ${unread ? 'bg-accent' : 'bg-transparent'} ${className}`}
    />
  )
}
