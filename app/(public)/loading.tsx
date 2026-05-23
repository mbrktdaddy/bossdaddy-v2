export default function Loading() {
 return (
 <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
 <div className="h-10 w-2/3 bg-surface-raised rounded mb-4" />
 <div className="h-4 w-1/2 bg-surface rounded mb-10" />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="bg-surface rounded-xl overflow-hidden">
 <div className="h-44 bg-surface-raised" />
 <div className="p-5 space-y-3">
 <div className="h-3 w-24 bg-surface-raised rounded" />
 <div className="h-5 w-3/4 bg-surface-raised rounded" />
 <div className="h-4 w-16 bg-surface-raised rounded" />
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}
