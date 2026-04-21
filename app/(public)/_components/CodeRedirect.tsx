'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function CodeRedirect() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      router.replace(`/reset-password?code=${code}`)
    }
  }, [searchParams, router])

  return null
}
