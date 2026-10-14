'use client'

import { useEffect, useState } from 'react'

export default function WelcomeToast() {
  const [username, setUsername] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('just_signed_in')
    if (stored) {
      sessionStorage.removeItem('just_signed_in')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername(stored)
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!username || !visible) return null

  return (
    <div data-theme="dark" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-chrome border-t-4 border-accent text-prose px-5 py-3 rounded-xl">
      <p className="text-sm font-medium whitespace-nowrap">
        Welcome back, <span className="text-accent-text">@{username}</span>
      </p>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="ml-1 text-prose-faint hover:text-prose transition-colors leading-none"
      >
        ✕
      </button>
    </div>
  )
}
