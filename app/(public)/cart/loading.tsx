import { Skeleton, SkeletonPage, SkeletonHeader } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <SkeletonPage className="max-w-3xl mx-auto px-6 py-12">
      {/* Back link */}
      <Skeleton soft className="h-3 w-16 mb-4" />
      <SkeletonHeader eyebrow />
      {/* Line items: square thumb + two text lines */}
      <div className="mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-4 border-b border-soft last:border-0">
            <Skeleton className="w-20 h-20 shrink-0" />
            <div className="flex-1 min-w-0 space-y-2 pt-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton soft className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      {/* Summary */}
      <div className="border-t border-soft pt-6 space-y-3">
        <Skeleton soft className="h-4 w-full" />
        <Skeleton soft className="h-4 w-2/3" />
        <Skeleton className="h-5 w-40 mt-2" />
      </div>
    </SkeletonPage>
  )
}
