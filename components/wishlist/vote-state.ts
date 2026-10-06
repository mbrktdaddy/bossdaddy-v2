import { VOTE_IDS_MAX } from '@/lib/wishlist'

// Per-user vote state for RadarVote, batched. A page renders a grid of Radar
// cards; each card's effect asks for its own item, and every ask made before
// the next macrotask goes out as ONE request (DataLoader-style) instead of one
// per card. Resolves null when the read fails, so the card keeps the count from
// the static render.

export interface VoteState {
  voted: boolean
  vote_count: number
  /** A vote also follows the item; false once the reader unsubscribes. */
  following: boolean
}

type Waiter = (state: VoteState | null) => void

let queue: Map<string, Waiter[]> | null = null

export function loadVoteState(id: string): Promise<VoteState | null> {
  return new Promise((resolve) => {
    if (!queue) {
      queue = new Map()
      setTimeout(flush, 0)
    }
    const waiters = queue.get(id)
    if (waiters) waiters.push(resolve)
    else queue.set(id, [resolve])
  })
}

async function flush() {
  const batch = queue
  queue = null
  if (!batch) return

  const ids = [...batch.keys()]
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += VOTE_IDS_MAX) chunks.push(ids.slice(i, i + VOTE_IDS_MAX))

  await Promise.all(chunks.map(async (chunk) => {
    let items: Record<string, VoteState> = {}
    try {
      const res = await fetch(`/api/wishlist/votes?ids=${chunk.join(',')}`)
      if (res.ok) items = ((await res.json()) as { items?: Record<string, VoteState> }).items ?? {}
    } catch {
      // Network failure: leave every card on its static count.
    }
    for (const id of chunk) for (const resolve of batch.get(id) ?? []) resolve(items[id] ?? null)
  }))
}
