export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 animate-pulse">
      {/* Page header */}
      <div className="h-10 w-48 bg-surface-raised rounded mb-2" />
      <div className="h-4 w-72 bg-surface rounded mb-8" />
      {/* Filter tabs */}
      <div className="flex gap-2 mb-8 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-20 bg-surface-raised rounded-full shrink-0" />
        ))}
      </div>
      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl overflow-hidden">
            <div className="h-48 bg-surface-raised" />
            <div className="p-5 space-y-3">
              <div className="h-3 w-20 bg-surface-raised rounded" />
              <div className="h-5 w-3/4 bg-surface-raised rounded" />
              <div className="h-4 w-1/2 bg-surface rounded" />
              <div className="h-4 w-16 bg-surface-raised rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
