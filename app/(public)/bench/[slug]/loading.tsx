export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-3 w-24 bg-gray-800 rounded mb-3" />
      <div className="h-10 w-2/3 bg-gray-800 rounded mb-6" />
      <div className="aspect-[16/9] bg-gray-800 rounded-2xl mb-8" />
      <div className="space-y-3 mb-10">
        <div className="h-4 w-full bg-gray-900 rounded" />
        <div className="h-4 w-5/6 bg-gray-900 rounded" />
        <div className="h-4 w-4/6 bg-gray-900 rounded" />
      </div>
      <div className="flex gap-3">
        <div className="h-12 w-32 bg-gray-800 rounded-lg" />
        <div className="h-12 w-32 bg-gray-800 rounded-lg" />
      </div>
    </div>
  )
}
