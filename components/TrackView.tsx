'use client'
import { useEffect } from 'react'
import { recordView } from '@/lib/recently-viewed'
import type { ViewedItem } from '@/lib/recently-viewed'

type Props = Omit<ViewedItem, 'viewed_at'>

export default function TrackView(props: Props) {
  useEffect(() => {
    recordView(props)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
