export interface ViewedItem {
  slug: string
  title: string
  type: 'review' | 'guide'
  category: string | null
  image_url: string | null
  viewed_at: number
}

const KEY = 'bd_recently_viewed'
const MAX = 10

function getAll(): ViewedItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as ViewedItem[]
  } catch {
    return []
  }
}

export function recordView(item: Omit<ViewedItem, 'viewed_at'>) {
  const all = getAll().filter((v) => !(v.slug === item.slug && v.type === item.type))
  const next: ViewedItem[] = [{ ...item, viewed_at: Date.now() }, ...all].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* storage quota exceeded — silently skip */ }
}

export function getRecent(exclude?: { slug: string; type: string }): ViewedItem[] {
  return getAll().filter(
    (v) => !(exclude && v.slug === exclude.slug && v.type === exclude.type),
  )
}
