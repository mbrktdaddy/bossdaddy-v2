import Link from 'next/link'
import Image from 'next/image'
import { vaultHref, vaultTypeLabel } from '@/lib/vault'

interface Collection {
  slug: string
  title: string
  description: string | null
  hero_image_url: string | null
  collection_type: string
  occasion?: string | null
}

interface Props {
  col: Collection
  priority?: boolean
  /** Footer line ("See the scorecard →"). Omitted on mixed-type grids. */
  cta?: string
}

/**
 * The one card for every Vault surface — homepage strip, /vault and its four
 * tabs. The 4px strip is a structural rule, not a per-type colour; type
 * identity lives in the orange dot + label (no per-type rainbow).
 */
export default function VaultCard({ col, priority = false, cta }: Props) {
  return (
    <Link
      href={vaultHref(col)}
      className="group flex flex-col h-full bg-surface border border-soft rounded-2xl overflow-hidden hover:border-strong hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="h-1 bg-strong" />
      <div className="relative aspect-[16/9] bg-surface-raised">
        {col.hero_image_url && (
          <Image
            src={col.hero_image_url}
            alt={col.title}
            fill
            priority={priority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="inline-flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-[10px] font-extrabold text-accent uppercase tracking-[0.16em]">
            {vaultTypeLabel(col.collection_type)}
          </span>
        </div>
        <h3 className="text-[15px] font-extrabold text-prose leading-snug mb-2 group-hover:text-accent transition-colors">
          {col.title}
        </h3>
        {col.description && (
          <p className="text-xs text-prose-muted leading-relaxed line-clamp-2">
            {col.description}
          </p>
        )}
        {cta && (
          <p className="mt-auto pt-4 text-xs text-accent-text font-semibold">{cta} →</p>
        )}
      </div>
    </Link>
  )
}
