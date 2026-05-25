export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-pulse">
      {/* Page header */}
      <div className="h-10 w-44 bg-surface-raised rounded mb-2" />
      <div className="h-4 w-80 bg-surface rounded mb-10" />
      {/* Section heading */}
      <div className="h-5 w-32 bg-surface-raised rounded mb-4" />
      {/* List rows */}
      <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-soft">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="w-14 h-14 bg-surface-raised rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-surface-raised rounded" />
              <div className="h-3 w-1/3 bg-surface rounded" />
            </div>
            <div className="h-6 w-16 bg-surface-raised rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
