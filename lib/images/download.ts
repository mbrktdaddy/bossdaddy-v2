// Client helper: trigger a real file download of a stored image through the
// /api/media/download proxy (which sets Content-Disposition: attachment). The
// proxy is same-origin, so this works cross-device including Android Chrome,
// where a bare cross-origin <a download> to the storage CDN is ignored.
export function downloadImage(url: string | null | undefined, name?: string) {
  if (!url) return
  const params = new URLSearchParams({ url })
  if (name) params.set('name', name)
  const a = document.createElement('a')
  a.href = `/api/media/download?${params.toString()}`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
