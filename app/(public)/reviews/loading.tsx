import { SkeletonPage, SkeletonHeader, SkeletonTabs, SkeletonCardGrid } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <SkeletonPage className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SkeletonHeader titleWidth="w-48" />
      <SkeletonTabs />
      <SkeletonCardGrid count={9} />
    </SkeletonPage>
  )
}
