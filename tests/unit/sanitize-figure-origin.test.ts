import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/lib/sanitize'
import { stripAuthoringAttrs } from '@/lib/content/html'
import { buildFilledFigure } from '@/lib/inlineImages'

// A filled figure's publication facts survive the save (sanitize) and the
// public render (stripAuthoringAttrs): width/height on the <img>, data-origin
// on the <figure>. The authoring three (prompt/alt/caption) are stripped on
// render, data-origin is not — it drives the credit line.

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
})
