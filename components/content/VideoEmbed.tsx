'use client'

import { useState } from 'react'
import Image from 'next/image'
import { youtubeEmbedUrl, youtubePoster, youtubeWatchUrl } from '@/lib/content/video'

interface Props {
  id: string
  caption?: string
}

/**
 * Click-to-load YouTube facade (docs/rich-elements-plan.md §4). Until the
 * reader taps play the page holds only a poster frame through next/image and a
 * button — no third-party iframe, no YouTube cookies, no Lighthouse hit. On tap
 * the privacy-domain iframe replaces it with autoplay. The watch link is the
 * no-JS / reduced-motion fallback.
 */
export default function VideoEmbed({ id, caption }: Props) {
  const [playing, setPlaying] = useState(false)
  const title = caption || 'Video'

  // A <div>, not a <figure>: ImageLightbox claims every <figure><img> in the
  // body, so a figure here would open the zoom overlay on the poster tap.
  return (
    <div className="bd-video">
      <div className="bd-video-frame">
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(id)}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full cursor-pointer"
            aria-label={`Play video: ${title}`}
          >
            <Image
              src={youtubePoster(id)}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-chrome/85 text-white transition-colors group-hover:bg-accent"
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <p className="bd-video-caption">
        {caption ? <span>{caption} · </span> : null}
        <a href={youtubeWatchUrl(id)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Watch on YouTube
        </a>
      </p>
    </div>
  )
}
