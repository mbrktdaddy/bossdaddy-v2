'use client'

import { useState, useSyncExternalStore } from 'react'
import { X_HANDLE } from '@/lib/social'

interface Props {
  title: string
  url?: string
}

const BTN_BASE =
  'place-items-center w-11 h-11 rounded-full border border-soft bg-surface text-prose-muted hover:text-prose hover:border-strong hover:bg-surface-raised transition-colors'
const BTN = `grid ${BTN_BASE}`

const noopSubscribe = () => () => {}

export default function ShareButtons({ title }: Props) {
  const [copied, setCopied] = useState(false)
  const canNativeShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  )

  const pageUrl = () => window.location.href

  function open(href: string) {
    window.open(href, '_blank', 'noopener')
  }

  function shareX() {
    const text = encodeURIComponent(`${title} — Boss Daddy Life`)
    open(`https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(pageUrl())}&via=${X_HANDLE}`)
  }

  function shareFacebook() {
    open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl())}`)
  }

  function shareReddit() {
    open(`https://reddit.com/submit?url=${encodeURIComponent(pageUrl())}&title=${encodeURIComponent(title)}`)
  }

  function shareEmail() {
    const subject = encodeURIComponent(`${title} — Boss Daddy Life`)
    const body = encodeURIComponent(`Thought you'd find this useful: ${pageUrl()}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  async function copyLink() {
    await navigator.clipboard.writeText(pageUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url: pageUrl() })
    } catch {
      // user dismissed the share sheet
    }
  }

  // On phones the native sheet already covers every network, so the network
  // buttons collapse into it rather than wrapping the row.
  const SOCIAL = canNativeShare ? `hidden sm:grid ${BTN_BASE}` : BTN

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {canNativeShare && (
        <button type="button" onClick={nativeShare} aria-label="Share" title="Share" className={`grid sm:hidden ${BTN_BASE}`}>
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12l-4 4m4-4l4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
          </svg>
        </button>
      )}

      <button type="button" onClick={shareX} aria-label="Share on X" title="Share on X" className={SOCIAL}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      <button type="button" onClick={shareFacebook} aria-label="Share on Facebook" title="Share on Facebook" className={SOCIAL}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </button>

      <button type="button" onClick={shareReddit} aria-label="Share on Reddit" title="Share on Reddit" className={SOCIAL}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      </button>

      <button type="button" onClick={shareEmail} aria-label="Share by email" title="Share by email" className={SOCIAL}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={copyLink}
        aria-label={copied ? 'Link copied' : 'Copy link'}
        title={copied ? 'Link copied' : 'Copy link'}
        className={`${BTN} ${copied ? 'text-forest border-forest/50' : ''}`}
      >
        {copied ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        )}
      </button>
      <span aria-live="polite" className="sr-only">{copied ? 'Link copied to clipboard' : ''}</span>
    </div>
  )
}
