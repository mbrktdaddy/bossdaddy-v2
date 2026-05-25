export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-3 w-32 bg-surface rounded mb-8" />
      {/* Header */}
      <div className="h-3 w-24 bg-surface-raised rounded mb-3" />
      <div className="h-10 w-2/3 bg-surface-raised rounded mb-3" />
      <div className="h-4 w-full max-w-lg bg-surface rounded mb-2" />
      <div className="h-4 w-3/4 bg-surface rounded mb-8" />
      {/* Editorial meta bar */}
      <div className="flex gap-6 mb-10">
        <div className="h-3 w-20 bg-surface rounded" />
        <div className="h-3 w-16 bg-surface rounded" />
        <div className="h-3 w-24 bg-surface rounded" />
      </div>
      {/* Ranked picks */}
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-5 p-5 bg-surface rounded-2xl">
            <div className="w-8 h-8 bg-surface-raised rounded-full shrink-0 mt-1" />
            <div className="w-24 h-24 bg-surface-raised rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-16 bg-surface-raised rounded" />
              <div className="h-5 w-3/4 bg-surface-raised rounded" />
              <div className="h-3 w-full bg-surface rounded" />
              <div className="h-3 w-2/3 bg-surface rounded" />
              <div className="h-8 w-28 bg-surface-raised rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
