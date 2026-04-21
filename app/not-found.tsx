import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-orange-500 text-xs uppercase tracking-widest font-semibold mb-4">404</p>
      <h1 className="text-4xl font-black text-white mb-3">Page not found</h1>
      <p className="text-gray-400 text-sm mb-8 max-w-sm">
        This page doesn&apos;t exist — or it may have moved. Head back and keep dadding like a boss.
      </p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <Link href="/" className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors text-sm">
          Go Home
        </Link>
        <Link href="/reviews" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-semibold rounded-xl transition-colors text-sm">
          Browse Reviews
        </Link>
      </div>
    </main>
  )
}
