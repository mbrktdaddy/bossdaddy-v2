'use client'

import { useEffect, useState } from 'react'

export default function WelcomeToast() {
  const [username, setUsername] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('just_signed_in')
    if (stored) {
      sessionStorage.removeItem('just_signed_in')
      setUsername(stored)
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!username || !visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 border border-orange-700/60 text-white px-5 py-3 rounded-2xl shadow-xl">
      <span className="text-orange-500 text-base">👊</span>
      <p className="text-sm font-medium whitespace-nowrap">
        Welcome back, <span className="text-orange-400">@{username}</span>
      </p>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="ml-1 text-gray-500 hover:text-white transition-colors leading-none"
      >
        ✕
      </button>
    </div>
  )
}
