import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <SkeletonPage className="max-w-2xl mx-auto px-6 py-16">
      {/* Back link */}
      <Skeleton soft className="h-3 w-16 mb-4" />
      {/* Status block: confirmation mark, eyebrow, order number, email */}
      <div className="mb-10 text-center">
        <Skeleton className="w-16 h-16 mx-auto mb-4" />
        <Skeleton className="h-3 w-40 mx-auto mb-3" />
        <Skeleton className="h-10 w-56 max-w-full mx-auto mb-2" />
        <Skeleton soft className="h-4 w-64 max-w-full mx-auto" />
      </div>
      {/* Line items */}
      <div className="mb-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b border-soft last:border-0">
            <Skeleton className="w-16 h-16 shrink-0" />
            <div className="flex-1 min-w-0 space-y-2 pt-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton soft className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
