import Link from 'next/link'
import { ChevronLeftIcon } from '@/components/icons'

interface Props {
  /** The logical PARENT page — never "wherever the visitor came from". */
  href:  string
  /** The parent's name ("Tools", "Messages"). Up-links name their destination. */
  label: string
  className?: string
}

// The "‹ Parent" up-link for app-like pages that have no breadcrumb.
//
// WHY A FIXED PARENT, NOT history.back(): the installed PWA runs `display:
// standalone` — there is no browser Back button on screen (iOS has no back
// gesture either), so this link is the only way up. And visitors who land from
// an email, notification or shared link have no history; history.back() would
// throw them out of the app. A deterministic parent always works.
//
// Content pages (reviews, guides, Vault details) use breadcrumbs instead — use
// ONE of the two on a page, never both.
export function BackLink({ href, label, className = 'mb-6' }: Props) {
  return (
    <nav aria-label="Back" className={className}>
      <Link
        href={href}
        className="inline-flex items-center gap-1 -ml-1 py-2.5 pr-3 min-h-[44px] text-sm font-medium text-prose-muted hover:text-accent-text-soft transition-colors"
      >
        <ChevronLeftIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
        {label}
      </Link>
    </nav>
  )
}
