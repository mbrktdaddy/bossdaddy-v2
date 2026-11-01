// The text card's plain data — sizes, limits and the input type — in a module
// with NO server imports, so a client component (the media picker's "Text
// card" tab) can read the labels and caps without dragging Satori, sharp and
// the font reads into the browser bundle. The renderer is lib/images/card.tsx
// (server-only); it re-exports everything here. The 2026-10-31 production
// build failed exactly because the picker imported the renderer for these
// constants ("Module not found: Can't resolve 'fs'" from sharp via next/og).

export type CardVariant = 'block' | 'photo'
export type CardSize = 'square' | 'landscape' | 'portrait'

export const CARD_SIZES: Readonly<Record<CardSize, { width: number; height: number; label: string; ratio: string }>> = {
  square:    { width: 1080, height: 1080, label: 'Square',    ratio: '1:1' },
  landscape: { width: 1200, height: 675,  label: 'Landscape', ratio: '16:9' },
  portrait:  { width: 1080, height: 1350, label: 'Portrait',  ratio: '4:5' },
}

export const CARD_TEXT_MAX = 140
export const CARD_LINE_MAX = 40

export interface CardInput {
  /** The statement. Up to CARD_TEXT_MAX characters; set in Montserrat Black. */
  text: string
  /** Small uppercase line above the statement, e.g. "Boss Daddy says" or a category. */
  kicker?: string
  /** Small line under the statement, e.g. "— Boss Daddy" or the piece's title. */
  attribution?: string
  variant: CardVariant
  size: CardSize
  /** `photo` only: the author's own photo as a data URI, already sized to the card. */
  imageDataUri?: string | null
}
