import Link from 'next/link'

interface Props {
  page: number
  total: number
  perPage: number
  basePath: string
  params?: Record<string, string>
}

export default function Pagination({ page, total, perPage, basePath, params = {} }: Props) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null

  function href(p: number) {
    const q = new URLSearchParams({ ...params, page: String(p) })
    return `${basePath}?${q}`
  }

  // Show at most 5 page numbers centered around current page
  const range: number[] = []
  const delta = 2
  const left = Math.max(1, page - delta)
  const right = Math.min(totalPages, page + delta)
  for (let i = left; i <= right; i++) range.push(i)

  return (
    <div className="flex items-center justify-center gap-1 mt-12">
      {/* Prev */}
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
        >
          ← Prev
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm text-gray-700 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">
          ← Prev
        </span>
      )}

      {/* Leading ellipsis */}
      {left > 1 && (
        <>
          <Link href={href(1)} className="px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors">1</Link>
          {left > 2 && <span className="px-2 text-gray-600 text-sm">…</span>}
        </>
      )}

      {/* Page numbers */}
      {range.map((p) => (
        p === page ? (
          <span key={p} className="px-3 py-2 text-sm font-semibold text-white bg-orange-600 border border-orange-600 rounded-lg">
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
          >
            {p}
          </Link>
        )
      ))}

      {/* Trailing ellipsis */}
      {right < totalPages && (
        <>
          {right < totalPages - 1 && <span className="px-2 text-gray-600 text-sm">…</span>}
          <Link href={href(totalPages)} className="px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors">{totalPages}</Link>
        </>
      )}

      {/* Next */}
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
        >
          Next →
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm text-gray-700 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">
          Next →
        </span>
      )}
    </div>
  )
}
