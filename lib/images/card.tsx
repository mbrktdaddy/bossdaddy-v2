import 'server-only'
import { ImageResponse } from 'next/og'
import type { ReactElement } from 'react'
import { loadMerchFonts } from '@/lib/merch/fonts'
import { BRAND } from '@/lib/brand'
import { CARD_SIZES, type CardInput } from './card-spec'

// Plain data (sizes, caps, the input type) lives in ./card-spec so client code
// can import it; this module is server-only (Satori + font reads + sharp via
// next/og) and would break the browser bundle if a client component touched it.
export { CARD_SIZES, CARD_TEXT_MAX, CARD_LINE_MAX, type CardInput, type CardSize, type CardVariant } from './card-spec'

// Text cards composed in CODE (Sprint C, 2026-10-31) — the "text in image"
// answer for social. An image model renders text as the uncanny tell (brand
// guide §2 "Images"); the site sets type itself, so a saying, a pull-quote or a
// kicker for X goes through Satori with the real Montserrat files, never
// through the image model. Hard Goods on a card: a chrome-black block with the
// orange rule, or the author's own photo under a scrim — one orange element,
// white type, no washes. Node runtime only (Satori + the font reads in
// lib/merch/fonts.ts; the route is listed in next.config.ts
// outputFileTracingIncludes so the TTFs ship with it).

// Dark-zone palette (app/globals.css): chrome black, hot orange, the AA orange
// for small type on black, white ink.
const CHROME = '#09090b'
const ORANGE = '#E55A1A'
const ORANGE_TEXT = '#f48a4a'
const INK = '#ffffff'
const INK_MUTED = '#d4d4d8'

/** Statement size by length, scaled to the card's width (1080 = 1×). */
function statementPx(text: string, width: number): number {
  const base = text.length <= 40 ? 96 : text.length <= 80 ? 76 : text.length <= 110 ? 62 : 54
  return Math.round(base * (width / 1080))
}

/** The Satori tree. Every multi-child node is display:flex (a Satori rule). */
export function cardElement(input: CardInput): ReactElement {
  const { width, height } = CARD_SIZES[input.size]
  const pad = Math.round(width * 0.074)
  const rule = Math.round(width * 0.012)
  const text = input.text.trim()
  const kicker = input.kicker?.trim()
  const attribution = input.attribution?.trim()
  const photo = input.variant === 'photo' && input.imageDataUri
  const statement = statementPx(text, width)
  const small = Math.round(width * 0.022)
  const wordmark = Math.round(width * 0.024)

  const Kicker = kicker ? (
    <div style={{ display: 'flex', color: ORANGE_TEXT, fontSize: small, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
      {kicker}
    </div>
  ) : null

  const Statement = (
    <div style={{
      display: 'flex',
      color: INK,
      fontSize: statement,
      fontWeight: 900,
      lineHeight: 1.04,
      letterSpacing: '-0.02em',
      textTransform: 'uppercase',
      textShadow: photo ? '0 2px 24px rgba(0,0,0,0.55)' : 'none',
    }}>
      {text}
    </div>
  )

  const Attribution = attribution ? (
    <div style={{ display: 'flex', color: INK_MUTED, fontSize: small, fontWeight: 600, letterSpacing: '0.04em' }}>
      {attribution}
    </div>
  ) : null

  const Footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', color: INK, fontSize: wordmark, fontWeight: 900, letterSpacing: '-0.02em' }}>
        BOSS DADDY LIFE
      </div>
      <div style={{ display: 'flex', color: ORANGE_TEXT, fontSize: small, fontWeight: 600 }}>
        {BRAND.tagline}
      </div>
    </div>
  )

  const Body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(width * 0.028), flexGrow: 1, justifyContent: 'center' }}>
      {Kicker}
      {Statement}
      {Attribution}
    </div>
  )

  if (photo) {
    return (
      <div style={{ width, height, display: 'flex', position: 'relative', fontFamily: 'Montserrat', backgroundColor: CHROME }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={input.imageDataUri!} alt="" width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, width, height, objectFit: 'cover' }} />
        {/* Scrim: legibility for white type over any photo. One gradient, no wash on the page. */}
        <div style={{ position: 'absolute', top: 0, left: 0, width, height, backgroundImage: 'linear-gradient(180deg, rgba(9,9,11,0.15) 0%, rgba(9,9,11,0.55) 55%, rgba(9,9,11,0.9) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width, height: rule, backgroundColor: ORANGE }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width, height, padding: pad, paddingTop: pad + rule }}>
          {Body}
          {Footer}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat', backgroundColor: CHROME, padding: pad, paddingTop: pad }}>
      <div style={{ display: 'flex', width: Math.round(width * 0.14), height: rule, backgroundColor: ORANGE, marginBottom: Math.round(width * 0.04) }} />
      {Body}
      {Footer}
    </div>
  )
}

/** Render to a PNG buffer with the brand fonts. The route converts to WebP and stores it. */
export async function renderCardPng(input: CardInput): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { width, height } = CARD_SIZES[input.size]
  const fonts = await loadMerchFonts()
  const image = new ImageResponse(cardElement(input), {
    width,
    height,
    fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })),
  })
  return { buffer: Buffer.from(await image.arrayBuffer()), width, height }
}
