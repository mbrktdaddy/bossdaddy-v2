interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-surface-raised rounded ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-xl border border-soft overflow-hidden">
      <Skeleton className="w-full h-48 rounded-none" />
      <div className="p-5 space-y-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
