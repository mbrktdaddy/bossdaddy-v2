export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Image gallery */}
        <div>
          <div className="w-full aspect-square bg-surface-raised rounded-2xl mb-3" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-16 h-16 bg-surface-raised rounded-lg" />
            ))}
          </div>
        </div>
        {/* Product details */}
        <div className="space-y-4">
          <div className="h-3 w-20 bg-surface-raised rounded" />
          <div className="h-8 w-3/4 bg-surface-raised rounded" />
          <div className="h-4 w-full bg-surface rounded" />
          <div className="h-4 w-5/6 bg-surface rounded" />
          <div className="h-8 w-28 bg-surface-raised rounded mt-2" />
          {/* Variant selector */}
          <div className="space-y-2 pt-2">
            <div className="h-3 w-16 bg-surface rounded" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 w-20 bg-surface-raised rounded-lg" />
              ))}
            </div>
          </div>
          {/* CTA */}
          <div className="h-12 w-full bg-surface-raised rounded-xl mt-4" />
        </div>
      </div>
    </div>
  )
}
