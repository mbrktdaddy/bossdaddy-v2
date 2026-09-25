// Loading-state primitives for `loading.tsx` files.
// The pulse lives on the container (<SkeletonPage>), not on each block, so the
// whole page breathes in sync. Blocks come in two tones: raised (default) for
// headings/images, `soft` for body lines.

interface SkeletonProps {
  className?: string
  soft?: boolean
}

export function Skeleton({ className = '', soft = false }: SkeletonProps) {
  return <div className={`${soft ? 'bg-surface' : 'bg-surface-raised'} rounded ${className}`} />
}

export function SkeletonPage({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`animate-pulse ${className}`}>{children}</div>
}

/** Page H1 + deck, optionally with the eyebrow line above (PageHeader shape). */
export function SkeletonHeader({ eyebrow = false, titleWidth = 'w-44' }: { eyebrow?: boolean; titleWidth?: string }) {
  return (
    <>
      {eyebrow && <Skeleton className="h-3 w-24 mb-3" />}
      <Skeleton className={`h-10 ${titleWidth} mb-2`} />
      <Skeleton soft className="h-4 w-80 max-w-full mb-10" />
    </>
  )
}

/** Horizontal filter-pill row on listing pages. */
export function SkeletonTabs({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-2 mb-8 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
      ))}
    </div>
  )
}

/** Image-on-top content card: eyebrow, title, one body line. */
export function SkeletonCard({ imageClassName = 'h-44' }: { imageClassName?: string }) {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden">
      <div className={`${imageClassName} bg-surface-raised`} />
      <div className="p-5 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton soft className="h-4 w-1/2" />
      </div>
    </div>
  )
}

/** The standard 1/2/3-column listing grid of SkeletonCards. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

/** Long-form article: eyebrow, two-line title, byline, hero image, body. */
export function SkeletonArticle() {
  return (
    <SkeletonPage className="max-w-3xl mx-auto px-4 py-8">
      <Skeleton className="h-3 w-32 mb-3" />
      <Skeleton className="h-12 w-full mb-3" />
      <Skeleton className="h-12 w-3/4 mb-6" />
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton soft className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="aspect-[16/10] rounded-xl mb-8" />
      <div className="space-y-3">
        {['w-full', 'w-full', 'w-5/6', 'w-full', 'w-4/6'].map((w, i) => (
          <Skeleton key={i} soft className={`h-4 ${w}`} />
        ))}
      </div>
    </SkeletonPage>
  )
}
