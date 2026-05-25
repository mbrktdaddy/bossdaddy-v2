export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
      {/* Page header */}
      <div className="h-3 w-24 bg-surface-raised rounded mb-3" />
      <div className="h-10 w-44 bg-surface-raised rounded mb-2" />
      <div className="h-4 w-80 bg-surface rounded mb-10" />
      {/* Occasion cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl overflow-hidden">
            <div className="h-36 bg-surface-raised" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 bg-surface-raised rounded" />
              <div className="h-3 w-1/2 bg-surface rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
