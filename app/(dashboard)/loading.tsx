export default function Loading() {
  return (
    <div className="p-6 md:p-8 animate-pulse">
      <div className="h-8 w-48 bg-gray-800 rounded mb-2" />
      <div className="h-4 w-64 bg-gray-900 rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="h-3 w-20 bg-gray-800 rounded mb-3" />
            <div className="h-7 w-12 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="h-4 w-2/3 bg-gray-800 rounded mb-2" />
            <div className="h-3 w-1/3 bg-gray-900 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
