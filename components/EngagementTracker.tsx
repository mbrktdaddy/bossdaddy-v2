'use client'

import { useEffect } from 'react'

interface Props {
  contentType: 'article' | 'review'
  contentId: string
  /** CSS selector of the article body to track scroll within. Defaults to .bd-content */
  scrollTarget?: string
}

const MILESTONES = [25, 50, 75, 100] as const
type Milestone = typeof MILESTONES[number]

// Same patterns as lib/affiliate.ts — kept inline so we don't drag a server
// import into a client component.
const AFFILIATE_HOST_PATTERNS: RegExp[] = [
  /amzn\.to/i,
  /amazon\.com.*[?&]tag=/i,
  /shareasale\.com/i,
  /clickbank\.net/i,
  /hop\.clickbank\.net/i,
  /jvzoo\.com/i,
  /geni\.us/i,
  /bossdaddylife\.com\/go\//i,
]

function isAffiliateUrl(href: string): boolean {
  return AFFILIATE_HOST_PATTERNS.some((p) => p.test(href))
}

export default function EngagementTracker({ contentType, contentId, scrollTarget = '.bd-content' }: Props) {
  // ── Scroll depth ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sessionKey = `bd:scroll:${contentType}:${contentId}`
    const fired = new Set<Milestone>()

    // Restore already-fired milestones from session storage so we never
    // double-count even if the user reloads or navigates back.
    try {
      const raw = sessionStorage.getItem(sessionKey)
      if (raw) {
        for (const m of JSON.parse(raw) as Milestone[]) fired.add(m)
      }
    } catch { /* ignore */ }

    function fire(m: Milestone) {
      if (fired.has(m)) return
      fired.add(m)
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify([...fired]))
      } catch { /* ignore */ }
      fetch('/api/track/scroll-depth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: contentType, content_id: contentId, milestone: m }),
      }).catch(() => {})
    }

    function check() {
      const el = document.querySelector(scrollTarget) as HTMLElement | null
      if (!el) return
      const rect = el.getBoundingClientRect()
      const articleHeight = el.offsetHeight
      const viewportHeight = window.innerHeight
      if (articleHeight <= 0) return
      const scrolled = Math.min(
        Math.max(0, -rect.top + viewportHeight * 0.3),
        articleHeight,
      )
      const pct = Math.min(100, (scrolled / articleHeight) * 100)
      for (const m of MILESTONES) {
        if (pct >= m) fire(m)
      }
    }

    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [contentType, contentId, scrollTarget])

  // ── Affiliate link click tracking ────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!isAffiliateUrl(href)) return

      const productSlug = anchor.dataset.productSlug ?? null

      // Use sendBeacon for reliable delivery during navigation. The browser
      // queues it even as the page is unloading; we don't await it.
      const payload = JSON.stringify({
        content_type:    contentType,
        content_id:      contentId,
        product_slug:    productSlug,
        destination_url: href,
      })

      try {
        const blob = new Blob([payload], { type: 'application/json' })
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track/cta-click', blob)
        } else {
          fetch('/api/track/cta-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {})
        }
      } catch { /* ignore */ }
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
    }
  }, [contentType, contentId])

  return null
}
