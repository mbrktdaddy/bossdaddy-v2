import Link from 'next/link'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { buttonVariants } from '@/components/ui/Button'

interface Props {
  /** Small label above the title — names the section's ROLE, rendered as a solid black block. */
  eyebrow: string
  /** The section title — Montserrat black (one voice, 2026-10-08), uppercase since Hard Goods. */
  title: string
  /** Optional right-aligned action (e.g. "All reviews") — rendered as the outline button. */
  right?: {
    label: string
    /** Shown instead of `label` below `sm` — for labels that repeat the title right above them
     *  ("View all in Health & Wellness" → "View all"). */
    shortLabel?: string
    href: string
    title?: string
  }
}

/**
 * The editorial section header — Hard Goods (2026-10-14, brand-guide §5/§10).
 * Black label block (the role) + uppercase Montserrat black title + a 3px
 * black rule under the lockup, with an optional outline button on the right.
 * This is the "loud through blocks" mechanism applied at section level; the
 * old quiet grey eyebrow + sentence-case title read as plain on white.
 * Public editorial surfaces only (light canvas) — the 3px rule and the block
 * are chrome-black and would vanish inside a dark zone. Utility/admin
 * surfaces keep `SectionHeader`. Uppercase titles were left flexible at the
 * commit; flip to sentence case here if the walkthrough says so.
 */
export default function EditorialHeader({ eyebrow, title, right }: Props) {
  return (
    // flex-wrap: the button never shrinks (nowrap), so a long label drops under the
    // title instead of squeezing it into an overlap on a phone.
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6 pb-3 border-b-[3px] border-chrome">
      <div className="min-w-0">
        <LabelBlock>{eyebrow}</LabelBlock>
        <h2 className="font-black text-prose uppercase text-[26px] md:text-[34px] leading-[1.05] tracking-[-0.01em] mt-2.5">
          {title}
        </h2>
      </div>
      {right && (
        <Link
          href={right.href}
          title={right.title}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0 whitespace-nowrap' })}
        >
          {right.shortLabel ? (
            <>
              <span className="sm:hidden">{right.shortLabel}</span>
              <span className="hidden sm:inline">{right.label}</span>
            </>
          ) : (
            right.label
          )}
        </Link>
      )}
    </div>
  )
}
