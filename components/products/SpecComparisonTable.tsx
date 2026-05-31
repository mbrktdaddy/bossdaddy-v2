import Image from 'next/image'
import Link from 'next/link'
import { buildSpecComparison, type SpecComparisonColumn } from '@/lib/products'

interface Props {
  columns: SpecComparisonColumn[]
  /** Section eyebrow + heading. Omit to render the bare table (e.g. embedded). */
  eyebrow?: string
  heading?: string
  /** Anchor id for TOC scroll targets. */
  id?: string
  className?: string
}

/**
 * Side-by-side spec table for N products. Pure presentation — values are
 * rendered as React text children (auto-escaped), rows are the case-insensitive
 * union of every column's spec labels, and missing/ragged data degrades to "—".
 * See `buildSpecComparison` for the matrix rules.
 *
 * Renders nothing unless there are ≥2 columns and ≥1 shared/known spec row —
 * a single product or a set with no specs has nothing to compare.
 */
export default function SpecComparisonTable({ columns, eyebrow, heading, id, className }: Props) {
  if (columns.length < 2) return null
  const rows = buildSpecComparison(columns)
  if (rows.length === 0) return null

  // min-width grows with column count so cells stay legible on the mobile
  // horizontal scroll; first column is the label rail.
  const minWidth = 160 + columns.length * 130

  const table = (
    <div className="overflow-x-auto -mx-6 px-6">
      <table
        className="w-full border-separate border-spacing-0 bg-surface border border-soft rounded-xl overflow-hidden"
        style={{ minWidth: `${minWidth}px` }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="text-left px-4 py-3 text-xs uppercase tracking-widest text-prose-faint font-semibold border-b border-soft align-bottom"
            >
              Spec
            </th>
            {columns.map((col) => {
              const inner = (
                <>
                  <div className={`relative w-14 h-14 mx-auto mb-2 rounded-xl overflow-hidden bg-surface-sunken border transition-colors ${col.isPrimary ? 'border-accent-border' : 'border-soft group-hover:border-accent-border'}`}>
                    {col.imageUrl && (
                      <Image src={col.imageUrl} alt={col.name} fill className="object-cover" sizes="56px" />
                    )}
                  </div>
                  {col.brand && (
                    <p className="text-[10px] uppercase tracking-widest text-prose-faint leading-tight mb-0.5">{col.brand}</p>
                  )}
                  <p className={`text-[11px] font-bold leading-tight line-clamp-2 transition-colors ${col.isPrimary ? 'text-accent' : 'text-accent-text-soft group-hover:text-accent'}`}>
                    {col.name}
                  </p>
                </>
              )
              return (
                <th
                  key={col.slug}
                  scope="col"
                  className={`px-3 py-3 border-b border-soft align-bottom min-w-[120px] ${col.isPrimary ? 'bg-accent-tint/40' : ''}`}
                >
                  {col.href ? (
                    <Link href={col.href} className="group block text-center">{inner}</Link>
                  ) : (
                    <div className="block text-center">{inner}</div>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-soft/40">
              <th scope="row" className="text-left px-4 py-3 text-sm text-prose-muted font-medium border-t border-soft/40">{row.label}</th>
              {row.values.map((value, idx) => (
                <td
                  key={columns[idx].slug}
                  className={`px-4 py-3 text-center text-sm border-t border-soft/40 ${
                    columns[idx].isPrimary ? 'bg-accent-tint/30 text-prose font-medium' : 'text-prose-muted'
                  }`}
                >
                  {value ?? <span className="text-prose-faint">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (!eyebrow && !heading) {
    return <div id={id} className={className}>{table}</div>
  }

  return (
    <section id={id} className={`mb-12 ${className ?? ''}`} aria-label={heading ?? 'Spec comparison'}>
      <div className="mb-5">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        {eyebrow && <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">{eyebrow}</p>}
        {heading && <h2 className="text-2xl font-black text-prose leading-tight">{heading}</h2>}
      </div>
      {table}
    </section>
  )
}
