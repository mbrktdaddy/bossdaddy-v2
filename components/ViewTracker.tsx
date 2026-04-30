'use client'

import { useEffect } from 'react'

interface Props {
  id: string
  type: 'review' | 'article'
}

export default function ViewTracker({ id, type }: Props) {
  useEffect(() => {
    fetch(`/api/${type === 'review' ? 'reviews' : 'guides'}/${id}/view`, {
      method: 'POST',
    }).catch(() => {}) // fire and forget — never block the page
  }, [id, type])

  return null
}
