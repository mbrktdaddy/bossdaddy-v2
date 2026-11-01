import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/lib/sanitize'
import { stripAuthoringAttrs } from '@/lib/content/html'
import { buildFilledFigure, buildPlaceholderFigure } from '@/lib/inlineImages'

// A filled figure's publication facts survive the save (sanitize) and the
// public render (stripAuthoringAttrs): width/height on the <img>, data-origin
// on the <figure>. The authoring attrs (prompt/alt/caption and the photo
// editor's plan: need/shot/aspect/ask) are stripped on render, data-origin is
// not — it drives the credit line.

const URL = 'https://x.supabase.co/storage/v1/object/public/media/a.webp'

describe('figure facts through sanitize + render', () => {
  const fig = buildFilledFigure({ slotId: 's1', imageUrl: URL, alt: 'a', caption: 'c', prompt: 'secret prompt', width: 1536, height: 1024, origin: 'ai' })

  it('sanitize keeps data-origin, width and height', () => {
    const out = sanitizeHtml(fig)
    expect(out).toContain('data-origin="ai"')
    expect(out).toContain('width="1536"')
    expect(out).toContain('height="1024"')
    expect(out).toContain('data-slot-id="s1"')
  })

  it('render strips the authoring attrs but not the origin', () => {
    const out = stripAuthoringAttrs(sanitizeHtml(fig))
    expect(out).not.toContain('data-prompt')
    expect(out).not.toContain('secret prompt')
    expect(out).not.toContain('data-alt')
    expect(out).not.toContain('data-caption')
    expect(out).toContain('data-origin="ai"')
    expect(out).toContain('<figcaption>c</figcaption>')
  })

  it('sanitize drops an unknown figure attribute (no new leak path)', () => {
    const out = sanitizeHtml('<figure class="bd-image-filled" data-slot-id="s" data-full="x"><img src="' + URL + '" alt="a" /></figure>')
    expect(out).not.toContain('data-full')
  })

  it('sanitize keeps the photo editor plan on a figure', () => {
    const fig = buildPlaceholderFigure({ slotId: 's2', prompt: '', need: 'owned', shot: 'detail', aspect: '4:5', ask: 'a screenshot of the app' })
    const out = sanitizeHtml(fig)
    expect(out).toContain('data-need="owned"')
    expect(out).toContain('data-shot="detail"')
    expect(out).toContain('data-aspect="4:5"')
    expect(out).toContain('data-ask="a screenshot of the app"')
    expect(out).toContain('data-slot-id="s2"')
  })

  it('render strips the plan but not the origin', () => {
    const filled = buildFilledFigure({ slotId: 's3', imageUrl: URL, alt: 'a', caption: 'c', origin: 'own', need: 'owned', shot: 'detail', aspect: '4:5', ask: 'a screenshot of the app' })
    const out = stripAuthoringAttrs(sanitizeHtml(filled))
    expect(out).not.toMatch(/data-(need|shot|aspect|ask)/)
    expect(out).not.toContain('a screenshot of the app')
    expect(out).toContain('data-origin="own"')
    expect(out).toContain('<figcaption>c</figcaption>')
  })

  it('sanitize keeps the plan on figures only, not on a div', () => {
    const out = sanitizeHtml('<div class="bd-callout" data-need="owned" data-ask="x">hi</div>')
    expect(out).not.toMatch(/data-(need|ask)/)
    expect(out).toContain('hi')
  })
})
