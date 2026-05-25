export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
      {/* Page header */}
      <div className="h-3 w-24 bg-surface-raised rounded mb-3" />
      <div className="h-10 w-44 bg-surface-raised rounded mb-2" />
      <div className="h-4 w-80 bg-surface rounded mb-10" />
      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl overflow-hidden">
            <div className="h-44 bg-surface-raised" />
            <div className="p-5 space-y-3">
              <div className="h-3 w-20 bg-surface-raised rounded" />
              <div className="h-5 w-3/4 bg-surface-raised rounded" />
              <div className="h-3 w-full bg-surface rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
