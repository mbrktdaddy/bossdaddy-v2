export default function Loading() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-3 w-32 bg-surface-raised rounded mb-3" />
      <div className="h-12 w-full bg-surface-raised rounded mb-3" />
      <div className="h-12 w-3/4 bg-surface-raised rounded mb-6" />
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-full bg-surface-raised" />
        <div className="space-y-2">
          <div className="h-3 w-32 bg-surface-raised rounded" />
          <div className="h-3 w-20 bg-surface rounded" />
        </div>
      </div>
      <div className="aspect-[16/9] bg-surface-raised rounded-xl mb-8" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-surface rounded" />
        <div className="h-4 w-full bg-surface rounded" />
        <div className="h-4 w-5/6 bg-surface rounded" />
        <div className="h-4 w-full bg-surface rounded" />
        <div className="h-4 w-4/6 bg-surface rounded" />
      </div>
    </article>
  )
}
