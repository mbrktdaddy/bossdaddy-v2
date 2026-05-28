'use client'

import { useState, useSyncExternalStore } from 'react'
import type { Milestone, Unit } from '@/lib/dad-tools/calc'

// Subscribe no-op — we only need the server vs client snapshot split, not
// reactive updates. Stable identity to avoid resubscribe churn.
const noopSubscribe = () => () => {}

interface Props {
  N: number
  unit: Unit
  milestone: Milestone
  birthdate: string
  kidName: string | null   // raw — we strip to first initial for share assets
  customDate?: string
  customLabel?: string
}

export default function ShareMenu({
  N,
  unit,
  milestone,
  birthdate,
  kidName,
  customDate,
  customLabel,
}: Props) {
  const [copied, setCopied] = useState(false)

  const unitWord = unit === 'weekends'
    ? (N === 1 ? 'weekend' : 'weekends')
    : (N === 1 ? 'bedtime' : 'bedtimes')

  // Privacy-first initial used in the share text + OG card.
  const initial = (kidName?.trim()?.[0] ?? '').toUpperCase()

  const shareText = initial
    ? `${N.toLocaleString()} ${unitWord} left with ${initial}. Making them count.`
    : `${N.toLocaleString()} ${unitWord} left. Making them count.`

  // Mount detection via useSyncExternalStore — server snapshot returns false,
  // client snapshot returns true. Lets us compute browser-dependent values
  // (window.location, navigator.share) safely during render without setState
  // or hydration mismatches.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )

  const shareUrl = mounted
    ? (() => {
        const u = new URL('/tools/weekends-until', window.location.origin)
        u.searchParams.set('birthdate', birthdate)
        u.searchParams.set('milestone', milestone)
        u.searchParams.set('unit', unit)
        if (initial)     u.searchParams.set('for', initial)
        if (customDate)  u.searchParams.set('cd', customDate)
        if (customLabel) u.searchParams.set('cl', customLabel.slice(0, 40))
        return u.toString()
      })()
    : ''

  const mailtoHref = mounted
    ? (() => {
        const subject = encodeURIComponent(`${N.toLocaleString()} ${unitWord} left.`)
        const body = encodeURIComponent(
          `Hey — ran the Boss Daddy weekends calculator. ${shareText}\n\n` +
          `If you want to see it for yourself: ${shareUrl}\n`,
        )
        return `mailto:?subject=${subject}&body=${body}`
      })()
    : ''

  const nativeSupported = mounted && typeof navigator !== 'undefined' && 'share' in navigator

  function handleCopy() {
    if (!shareUrl) return
    const payload = `${shareText} ${shareUrl}`
    void navigator.clipboard.writeText(payload).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleNativeShare() {
    if (!nativeSupported) return
    void (navigator as Navigator & {
      share: (data: { title?: string; text?: string; url?: string }) => Promise<void>
    }).share({
      title: 'Weekends Until — Boss Daddy',
      text: shareText,
      url: shareUrl,
    }).catch(() => { /* user cancelled — no-op */ })
  }

  // Pre-mount: render a stable placeholder that matches the post-mount
  // shape so hydration is clean. Buttons are visible but disabled until
  // the URL is built (one tick after mount).
  if (!mounted) {
    return (
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-xs text-prose-faint uppercase tracking-widest font-medium">
          Share
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-wrap text-sm">
      <span className="text-xs text-prose-faint uppercase tracking-widest font-medium">
        Share
      </span>

      {nativeSupported && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="px-3 py-1.5 rounded-full border border-faint text-prose-faint hover:text-prose hover:border-accent transition-colors"
        >
          Share…
        </button>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className="px-3 py-1.5 rounded-full border border-faint text-prose-faint hover:text-prose hover:border-accent transition-colors"
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>

      <a
        href={mailtoHref}
        className="px-3 py-1.5 rounded-full border border-faint text-prose-faint hover:text-prose hover:border-accent transition-colors"
      >
        Send to spouse
      </a>
    </div>
  )
}
