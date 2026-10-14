import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <SkeletonPage className="max-w-4xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Image gallery: square well + thumbs */}
        <div>
          <Skeleton className="aspect-square w-full mb-3" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-16 h-16" />
            ))}
          </div>
        </div>
        {/* Product details */}
        <div className="space-y-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton soft className="h-4 w-full" />
          <Skeleton soft className="h-4 w-5/6" />
          <Skeleton className="h-8 w-28 mt-2" />
          {/* Variant selector */}
          <div className="space-y-2 pt-2">
            <Skeleton soft className="h-3 w-16" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20" />
              ))}
            </div>
          </div>
          {/* CTA */}
          <Skeleton className="h-12 w-full mt-4" />
        </div>
      </div>
    </SkeletonPage>
  )
}
