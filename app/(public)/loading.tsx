import { SkeletonPage, SkeletonHeader, SkeletonCardGrid } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <SkeletonPage className="max-w-6xl mx-auto px-4 py-8">
      <SkeletonHeader titleWidth="w-2/3" />
      <SkeletonCardGrid />
    </SkeletonPage>
  )
}
