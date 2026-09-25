import { SkeletonPage, SkeletonHeader, SkeletonCardGrid } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <SkeletonPage className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <SkeletonHeader eyebrow titleWidth="w-56" />
      <SkeletonCardGrid />
    </SkeletonPage>
  )
}
