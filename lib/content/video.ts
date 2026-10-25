// Video embeds (docs/rich-elements-plan.md §4). YouTube only, through the
// privacy domain, behind a click-to-load facade — the page never loads an
// iframe until the reader taps play. The stored marker carries only the ID,
// so no iframe ever passes the sanitizer.

export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/

/** The 11-char video ID from any YouTube URL shape, or null. */
export function parseYouTubeUrl(input: string): string | null {
  const s = input.trim()
  if (YOUTUBE_ID_RE.test(s)) return s
  let url: URL
  try { url = new URL(s) } catch { return null }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)
      id = m ? m[1] : null
    }
  }
  return id && YOUTUBE_ID_RE.test(id) ? id : null
}

export function youtubePoster(id: string): string {
  // hqdefault exists for every video (maxresdefault does not).
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export function youtubeEmbedUrl(id: string): string {
  // playsinline: iOS Safari otherwise forces fullscreen on autoplay after the tap.
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}
