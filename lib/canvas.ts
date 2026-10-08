/**
 * Canvas knob — the light-editorial rollout switch (decided 2026-10-08).
 *
 * The design system has two canvases in ONE token set (app/globals.css):
 *   :root                → the light editorial canvas (white page, near-black
 *                          text, black primary CTAs, orange accent)
 *   [data-theme="dark"]  → the dark palette
 *
 * Which one the PAGE gets is decided here, once, and applied as the
 * `data-theme` attribute on <html> in app/layout.tsx. The chrome — header,
 * footer, bottom nav, homepage hero, the Creed band, the dashboard — carries
 * its own `data-theme="dark"` regardless, so on the light canvas those stay
 * near-black: that is where the black/orange/white edge lives.
 *
 * FLIPPED 2026-10-08 (Phase 4): light is the default. The env read stays as
 * the escape hatch — `BD_CANVAS=dark` puts the dark palette back on <html> for
 * a side-by-side; nothing else changes. Default-safe, knob kept
 * (feedback_default_safe_keep_control).
 *
 * Server-only: read in Server Components at render time. Not NEXT_PUBLIC_ on
 * purpose — the client never needs it, the attribute is in the HTML.
 */
export type Canvas = 'light' | 'dark'

const DEFAULT: Canvas = 'light'

export const CANVAS: Canvas =
  process.env.BD_CANVAS === 'light' ? 'light'
  : process.env.BD_CANVAS === 'dark' ? 'dark'
  : DEFAULT

/**
 * Value for `<html data-theme>`. `undefined` renders NO attribute, which is the
 * :root light base — there is no `data-theme="light"` scope and there must not
 * be one: the light values are the base, the dark values are the override.
 */
export const HTML_THEME: 'dark' | undefined = CANVAS === 'dark' ? 'dark' : undefined
