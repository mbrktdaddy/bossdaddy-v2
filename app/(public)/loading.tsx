export default function Loading() {
 return (
 <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
 <div className="h-10 w-2/3 bg-gray-800 rounded mb-4" />
 <div className="h-4 w-1/2 bg-gray-900 rounded mb-10" />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="bg-gray-900 rounded-2xl overflow-hidden">
 <div className="h-44 bg-gray-800" />
 <div className="p-5 space-y-3">
 <div className="h-3 w-24 bg-gray-800 rounded" />
 <div className="h-5 w-3/4 bg-gray-800 rounded" />
 <div className="h-4 w-16 bg-gray-800 rounded" />
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}
