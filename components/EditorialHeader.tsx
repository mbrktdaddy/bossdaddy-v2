import Link from 'next/link'

interface Props {
  /** Small uppercase kicker above the title (names the section's ROLE). */
  eyebrow: string
  /** The section title — rendered in the Fraunces editorial serif. */
  title: string
  /** Optional right-aligned link (e.g. "All reviews →"). */
  right?: { label: string; href: string; title?: string }
}

/**
 * Manifesto v2 section header — the site-wide editorial pattern:
 * small sans eyebrow (role) + big Fraunces serif title, with an optional
 * right link. Replaces the 3px-rule SectionHeader on public editorial
 * surfaces. Keep eyebrows naming the ROLE, never repeating the title.
 * (Compact/admin surfaces may still use SectionHeader.)
 */
export default function EditorialHeader({ eyebrow, title, right }: Props) {
  return (
    <div className="flex items-end justify-between gap-4 mb-7">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-eyebrow">
          {eyebrow}
        </p>
        <h2 className="font-editorial-display font-semibold text-prose text-3xl md:text-4xl leading-[1.05] tracking-tight mt-2">
          {title}
        </h2>
      </div>
      {right && (
        <Link
          href={right.href}
          title={right.title}
          className="inline-flex items-center shrink-0 whitespace-nowrap text-[11px] sm:text-xs font-bold uppercase tracking-[0.08em] text-accent hover:text-accent-hover transition-colors"
        >
          {right.label} →
        </Link>
      )}
    </div>
  )
}
