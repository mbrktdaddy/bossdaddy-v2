'use client'

import { useState } from 'react'

interface Props {
  title: string
  url?: string
}

export default function ShareButtons({ title }: Props) {
  const [copied, setCopied] = useState(false)

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  function shareTwitter() {
    const text = encodeURIComponent(`${title} — Boss Daddy Life`)
    const u = encodeURIComponent(pageUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${u}`, '_blank', 'noopener')
  }

  async function copyLink() {
    await navigator.clipboard.writeText(pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">Share</span>

      <button
        onClick={shareTwitter}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Post
      </button>

      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400">Copied!</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Link
          </>
        )}
      </button>
    </div>
  )
}
