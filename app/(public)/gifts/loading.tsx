import { SkeletonPage, SkeletonHeader, SkeletonCard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <SkeletonPage className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <SkeletonHeader eyebrow />
      {/* Occasion cards grid — denser than the standard listing grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} imageClassName="h-36" />
        ))}
      </div>
    </SkeletonPage>
  )
}
