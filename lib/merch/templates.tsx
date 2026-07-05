import type { ReactElement } from 'react'

// Brand-locked merch design templates. Each returns a Satori-compatible element
// sized W×H. Backgrounds are transparent for print (garment shows through); the
// render route passes a mock garment color only for on-screen preview.
//
// Satori constraints honored throughout: every multi-child node is display:flex;
// only Montserrat (900 / 600) is used (the fonts registered in lib/merch/fonts.ts).

export const MERCH_TEMPLATES = ['statement', 'stacked', 'wordmark', 'logo'] as const
export type MerchTemplate = (typeof MERCH_TEMPLATES)[number]

export const MERCH_COLORWAYS = ['dark', 'light'] as const
export type MerchColorway = (typeof MERCH_COLORWAYS)[number]

export interface Colorway {
  ink: string      // primary text
  accent: string   // brand orange
  sub: string      // subline / secondary text
}

// 'dark'  → prints on dark garments (warm off-white ink, Hot orange accent)
// 'light' → prints on light garments (near-black ink, core orange accent)
export const COLORWAYS: Record<MerchColorway, Colorway> = {
  dark:  { ink: '#F5EFE6', accent: '#E55A1A', sub: '#C9C2B6' },
  light: { ink: '#161616', accent: '#CC5500', sub: '#4A4A4A' },
}

export interface TemplateProps {
  text: string
  subline?: string
  colorway: Colorway
  bg: string        // 'transparent' (print) or a garment hex (preview)
  W: number
  H: number
  logo?: string     // data URI, required by the 'logo' template
}

// Fit the statement font to the line length so short punchlines read huge and
// longer sayings still fit the print area. Sized relative to canvas width.
function statementSize(text: string, W: number): number {
  const len = text.trim().length
  if (len <= 8) return W * 0.185
  if (len <= 14) return W * 0.145
  if (len <= 22) return W * 0.11
  if (len <= 34) return W * 0.085
  return W * 0.066
}

function Root({ W, H, bg, children }: { W: number; H: number; bg: string; children: ReactElement }): ReactElement {
  return (
    <div
      style={{
        width: `${W}px`,
        height: `${H}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        padding: `${Math.round(W * 0.08)}px`,
        fontFamily: 'Montserrat',
      }}
    >
      {children}
    </div>
  )
}

// Big centered statement, optional accent rule + subline beneath.
function statement(p: TemplateProps): ReactElement {
  const size = statementSize(p.text, p.W)
  return (
    <Root W={p.W} H={p.H} bg={p.bg}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            color: p.colorway.ink,
            fontSize: `${size}px`,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {p.text}
        </div>
        {p.subline ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: `${p.W * 0.045}px` }}>
            <div style={{ width: `${p.W * 0.16}px`, height: `${Math.max(3, p.W * 0.007)}px`, backgroundColor: p.colorway.accent }} />
            <div
              style={{
                display: 'flex',
                color: p.colorway.sub,
                fontSize: `${p.W * 0.045}px`,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginTop: `${p.W * 0.03}px`,
                textAlign: 'center',
              }}
            >
              {p.subline}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', width: `${p.W * 0.16}px`, height: `${Math.max(3, p.W * 0.007)}px`, backgroundColor: p.colorway.accent, marginTop: `${p.W * 0.05}px` }} />
        )}
      </div>
    </Root>
  )
}

// Statement with a small "BOSS DADDY" wordmark anchored below — signed merch.
function stacked(p: TemplateProps): ReactElement {
  const size = statementSize(p.text, p.W) * 0.92
  return (
    <Root W={p.W} H={p.H} bg={p.bg}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            color: p.colorway.ink,
            fontSize: `${size}px`,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {p.text}
        </div>
        {p.subline ? (
          <div style={{ display: 'flex', color: p.colorway.sub, fontSize: `${p.W * 0.045}px`, fontWeight: 600, letterSpacing: '0.04em', marginTop: `${p.W * 0.03}px`, textAlign: 'center' }}>
            {p.subline}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: `${p.W * 0.06}px` }}>
          <div style={{ display: 'flex', width: `${p.W * 0.08}px`, height: `${Math.max(2, p.W * 0.005)}px`, backgroundColor: p.colorway.accent, marginRight: `${p.W * 0.025}px` }} />
          <div style={{ display: 'flex', fontSize: `${p.W * 0.05}px`, fontWeight: 900, letterSpacing: '0.02em' }}>
            <span style={{ color: p.colorway.accent }}>BOSS</span>
            <span style={{ color: p.colorway.ink, marginLeft: `${p.W * 0.015}px` }}>DADDY</span>
          </div>
          <div style={{ display: 'flex', width: `${p.W * 0.08}px`, height: `${Math.max(2, p.W * 0.005)}px`, backgroundColor: p.colorway.accent, marginLeft: `${p.W * 0.025}px` }} />
        </div>
      </div>
    </Root>
  )
}

// "BOSS DADDY" wordmark lead, saying beneath.
function wordmark(p: TemplateProps): ReactElement {
  return (
    <Root W={p.W} H={p.H} bg={p.bg}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', fontSize: `${p.W * 0.13}px`, fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1 }}>
          <span style={{ color: p.colorway.accent }}>BOSS</span>
          <span style={{ color: p.colorway.ink, marginLeft: `${p.W * 0.03}px` }}>DADDY</span>
        </div>
        <div style={{ display: 'flex', width: `${p.W * 0.5}px`, height: `${Math.max(3, p.W * 0.008)}px`, backgroundColor: p.colorway.accent, marginTop: `${p.W * 0.03}px`, marginBottom: `${p.W * 0.03}px` }} />
        <div
          style={{
            display: 'flex',
            color: p.colorway.ink,
            fontSize: `${Math.min(statementSize(p.text, p.W), p.W * 0.1)}px`,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {p.text}
        </div>
      </div>
    </Root>
  )
}

// Logo icon + "BOSS DADDY LIFE" wordmark — logo-only merch, no saying.
function logo(p: TemplateProps): ReactElement {
  const size = Math.round(p.W * 0.42)
  return (
    <Root W={p.W} H={p.H} bg={p.bg}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {p.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo} alt="" width={size} height={size} style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }} />
        ) : null}
        <div style={{ display: 'flex', fontSize: `${p.W * 0.085}px`, fontWeight: 900, letterSpacing: '0.01em', marginTop: `${p.W * 0.04}px` }}>
          <span style={{ color: p.colorway.accent }}>BOSS</span>
          <span style={{ color: p.colorway.ink, marginLeft: `${p.W * 0.02}px` }}>DADDY</span>
          <span style={{ color: p.colorway.ink, marginLeft: `${p.W * 0.02}px` }}>LIFE</span>
        </div>
      </div>
    </Root>
  )
}

const RENDERERS: Record<MerchTemplate, (p: TemplateProps) => ReactElement> = {
  statement,
  stacked,
  wordmark,
  logo,
}

export function renderTemplate(template: MerchTemplate, props: TemplateProps): ReactElement {
  return (RENDERERS[template] ?? statement)(props)
}
