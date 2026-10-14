import Link from 'next/link'
import { buttonVariants } from '@/components/ui/Button'

/**
 * The UTILITY-lane section header (two lanes, settled 2026-07-27): a 3px
 * orange vertical rule + uppercase tracked label (+ optional heading / sub).
 * /gear, dashboard, admin, compact panels. Editorial surfaces use
 * `EditorialHeader`. Hard Goods (2026-10-14): the right action is the outline
 * button at every width, matching `EditorialHeader`; the rule stays orange so
 * the two lanes stay tellable.
 */
interface Props {
  label: string
  heading?: string
  sub?: string
  right?: { label: string; href: string; title?: string }
}

export default function SectionHeader({ label, heading, sub, right }: Props) {
  return (
    <div className="flex items-end justify-between mb-7 gap-4">
      <div className="flex items-stretch gap-3 min-w-0">
        <div className="w-[3px] bg-accent rounded-full shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] uppercase tracking-[0.18em] font-black text-prose">
            {label}
          </p>
          {heading && (
            <h2 className="mt-2 text-2xl md:text-3xl font-black text-prose leading-tight">
              {heading}
            </h2>
          )}
          {sub && (
            <p className="mt-2 text-sm text-prose-muted">{sub}</p>
          )}
        </div>
      </div>
      {right && (
        <Link
          href={right.href}
          title={right.title}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0 whitespace-nowrap' })}
        >
          {right.label}
        </Link>
      )}
    </div>
  )
}
