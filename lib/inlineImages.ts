/**
 * Inline-image management — pure-string operations on article/review HTML.
 *
 * Every inline image is represented as a `<figure>` with a `data-slot-id` and
 * `data-prompt` / `data-alt` / `data-caption` attributes carrying the metadata.
 * The InlineMediaPanel renders one card per slot and calls these helpers to
 * mutate the body content as the user clicks visual buttons.
 */

const SLOT_ID_PREFIX = 'slot-'

export interface InlineSlot {
  slotId: string
  prompt: string
  alt: string
  caption: string
  filled: boolean
  imageUrl?: string
  start: number   // index into source content where the figure starts
  end: number     // index into source content where the figure ends (exclusive)
  raw: string     // exact substring of the figure block
}

export interface H2Heading {
  text: string
  start: number
  end: number     // index just past </h2>
}

export type InsertPosition =
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'afterHeading'; index: number }

// ---------------------------------------------------------------------------
// internal helpers

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function setAttr(tagOpen: string, name: string, value: string): string {
  const re = new RegExp(`\\b${escapeRegex(name)}="[^"]*"`)
  if (re.test(tagOpen)) return tagOpen.replace(re, `${name}="${value}"`)
  return tagOpen.replace(/>\s*$/, ` ${name}="${value}">`)
}

// ---------------------------------------------------------------------------
// ID + markup builders

export function createSlotId(): string {
  return SLOT_ID_PREFIX + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

interface BuildFilledArgs {
  imageUrl: string
  alt: string
  caption?: string
  prompt?: string
  slotId?: string
}
export function buildFilledFigure(args: BuildFilledArgs): string {
  const slotId  = args.slotId ?? createSlotId()
  const caption = args.caption ?? ''
  const figcap  = caption.trim() ? `<figcaption>${escAttr(caption)}</figcaption>` : ''
  return `<figure class="bd-image-filled" data-slot-id="${escAttr(slotId)}" data-prompt="${escAttr(args.prompt ?? '')}" data-alt="${escAttr(args.alt)}" data-caption="${escAttr(caption)}"><img src="${escAttr(args.imageUrl)}" alt="${escAttr(args.alt)}" />${figcap}</figure>`
}

interface BuildPlaceholderArgs {
  prompt?: string
  alt?: string
  caption?: string
  slotId?: string
}
export function buildPlaceholderFigure(args: BuildPlaceholderArgs): string {
  const slotId  = args.slotId ?? createSlotId()
  const caption = args.caption ?? args.alt ?? args.prompt ?? 'Image slot'
  return `<figure class="bd-image-placeholder" data-slot-id="${escAttr(slotId)}" data-prompt="${escAttr(args.prompt ?? '')}" data-alt="${escAttr(args.alt ?? '')}" data-caption="${escAttr(args.caption ?? '')}"><figcaption>${escAttr(caption)}</figcaption></figure>`
}

// ---------------------------------------------------------------------------
// Extraction

const FIGURE_WITH_ID_RE = /<figure\b[^>]*\bdata-slot-id="([^"]+)"[^>]*>[\s\S]*?<\/figure>/g

export function extractSlots(content: string): InlineSlot[] {
  const out: InlineSlot[] = []
  const re = new RegExp(FIGURE_WITH_ID_RE.source, FIGURE_WITH_ID_RE.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const raw = m[0]
    const slotId = m[1]
    const filled = /class="[^"]*\bbd-image-filled\b/.test(raw)
    const imgSrc = raw.match(/<img[^>]*\bsrc="([^"]*)"/)?.[1]
    out.push({
      slotId,
      prompt:   decodeAttr(raw.match(/data-prompt="([^"]*)"/)?.[1] ?? ''),
      alt:      decodeAttr(raw.match(/data-alt="([^"]*)"/)?.[1] ?? ''),
      caption:  decodeAttr(raw.match(/data-caption="([^"]*)"/)?.[1] ?? ''),
      filled,
      imageUrl: imgSrc ? decodeAttr(imgSrc) : undefined,
      start: m.index,
      end:   m.index + raw.length,
      raw,
    })
  }
  return out
}

export function extractH2Headings(content: string): H2Heading[] {
  const out: H2Heading[] = []
  const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    out.push({
      text: m[1].replace(/<[^>]*>/g, '').trim(),
      start: m.index,
      end:   m.index + m[0].length,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Auto-promotion — give every untagged <figure> a slot-id so the panel can
// manage it. Runs once per workspace mount (idempotent — figures that already
// have a slot-id are left untouched).

export function promoteUntaggedFigures(content: string): string {
  return content.replace(
    /<figure\b([^>]*)>([\s\S]*?)<\/figure>/g,
    (full, attrs, body) => {
      if (/\bdata-slot-id=/.test(attrs)) return full

      const slotId   = createSlotId()
      const altMatch = body.match(/<img[^>]*\balt="([^"]*)"/)
      const srcMatch = body.match(/<img[^>]*\bsrc="([^"]*)"/)
      const capMatch = body.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)
      const alt      = altMatch?.[1] ?? ''
      const caption  = capMatch?.[1].replace(/<[^>]*>/g, '').trim() ?? ''
      const klass    = srcMatch ? 'bd-image-filled' : 'bd-image-placeholder'

      const cleanAttrs = attrs.replace(/\bclass="[^"]*"/g, '').trim()
      const newAttrs = [
        `class="${klass}"`,
        `data-slot-id="${slotId}"`,
        `data-prompt=""`,
        `data-alt="${alt}"`,
        `data-caption="${escAttr(caption)}"`,
        cleanAttrs,
      ].filter(Boolean).join(' ')

      return `<figure ${newAttrs}>${body}</figure>`
    }
  )
}

// ---------------------------------------------------------------------------
// Mutations

function figureBlockRegex(slotId: string): RegExp {
  return new RegExp(
    `(<figure\\b[^>]*\\bdata-slot-id="${escapeRegex(slotId)}"[^>]*>)([\\s\\S]*?)(</figure>)`,
    'g',
  )
}

export function updateSlotMeta(
  content: string,
  slotId: string,
  patch: Partial<{ caption: string; alt: string; prompt: string }>,
): string {
  return content.replace(figureBlockRegex(slotId), (_full, openTag, body, closeTag) => {
    let newOpen = openTag as string
    let newBody = body as string

    if (patch.caption !== undefined) {
      const v = escAttr(patch.caption)
      newOpen = setAttr(newOpen, 'data-caption', v)
      const cap = patch.caption.trim()
      if (/<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/.test(newBody)) {
        newBody = newBody.replace(
          /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/,
          cap ? `<figcaption>${escAttr(cap)}</figcaption>` : '',
        )
      } else if (cap) {
        newBody = newBody + `<figcaption>${escAttr(cap)}</figcaption>`
      }
    }

    if (patch.alt !== undefined) {
      const v = escAttr(patch.alt)
      newOpen = setAttr(newOpen, 'data-alt', v)
      if (/<img[^>]*\balt="[^"]*"/.test(newBody)) {
        newBody = newBody.replace(/(<img[^>]*\balt=)"[^"]*"/, `$1"${v}"`)
      } else if (/<img\b/.test(newBody)) {
        newBody = newBody.replace(/<img\b/, `<img alt="${v}"`)
      }
    }

    if (patch.prompt !== undefined) {
      newOpen = setAttr(newOpen, 'data-prompt', escAttr(patch.prompt))
    }

    return newOpen + newBody + closeTag
  })
}

export function fillSlot(content: string, slotId: string, imageUrl: string, alt?: string): string {
  return content.replace(figureBlockRegex(slotId), (_full, openTag, _body, closeTag) => {
    const open = openTag as string
    const close = closeTag as string
    const captionText = decodeAttr(open.match(/data-caption="([^"]*)"/)?.[1] ?? '')
    const dataAlt     = decodeAttr(open.match(/data-alt="([^"]*)"/)?.[1] ?? '')
    const finalAlt    = (alt ?? dataAlt) || ''

    // Replace class with bd-image-filled
    const newOpenTag = open.replace(/\bclass="[^"]*"/, 'class="bd-image-filled"')
    // Update data-alt if a new alt was supplied
    const finalOpenTag = alt !== undefined ? setAttr(newOpenTag, 'data-alt', escAttr(alt)) : newOpenTag

    const img    = `<img src="${escAttr(imageUrl)}" alt="${escAttr(finalAlt)}" />`
    const figcap = captionText.trim() ? `<figcaption>${escAttr(captionText)}</figcaption>` : ''
    return finalOpenTag + img + figcap + close
  })
}

export function revertSlot(content: string, slotId: string): string {
  return content.replace(figureBlockRegex(slotId), (_full, openTag, _body, closeTag) => {
    const open = openTag as string
    const close = closeTag as string
    const captionText = decodeAttr(open.match(/data-caption="([^"]*)"/)?.[1] ?? '')
    const newOpen = open.replace(/\bclass="[^"]*"/, 'class="bd-image-placeholder"')
    const figcap  = `<figcaption>${escAttr(captionText || 'Image slot')}</figcaption>`
    return newOpen + figcap + close
  })
}

export function removeSlot(content: string, slotId: string): string {
  const re = new RegExp(
    `<figure\\b[^>]*\\bdata-slot-id="${escapeRegex(slotId)}"[^>]*>[\\s\\S]*?</figure>`,
    'g',
  )
  return content.replace(re, '').replace(/\n{3,}/g, '\n\n')
}

/**
 * Move a slot to a new 1-based position within the ordered list of figures.
 * Surrounding prose stays put — only the figures themselves are re-ordered.
 */
export function moveSlotToPosition(content: string, slotId: string, targetPos: number): string {
  const slots = extractSlots(content)
  const sourceIdx = slots.findIndex((s) => s.slotId === slotId)
  if (sourceIdx === -1 || slots.length <= 1) return content

  const clamped = Math.max(1, Math.min(targetPos, slots.length))
  if (clamped === sourceIdx + 1) return content

  const source = slots[sourceIdx]

  // 1. Remove the source figure
  const withoutSource = content.slice(0, source.start) + content.slice(source.end)

  // 2. Re-extract slot positions in the new content
  const remaining = extractSlots(withoutSource)

  // 3. Decide where to splice the source back in
  let insertAt: number
  if (clamped - 1 >= remaining.length) {
    // Append after the last remaining figure
    insertAt = remaining.length === 0 ? withoutSource.length : remaining[remaining.length - 1].end
  } else {
    // Insert at the start of the figure currently at the target position
    insertAt = remaining[clamped - 1].start
  }

  return withoutSource.slice(0, insertAt) + source.raw + withoutSource.slice(insertAt)
}

/**
 * Re-attach inline images from old content into a freshly refined version.
 * For each image, find the H2 heading it followed in the old content; if a
 * heading with the same text exists in the new content, splice the image in
 * after that heading. Images with no matching heading are appended at the end.
 *
 * The point: AI refines wipe `<figure>` blocks today (they only rebuild prose).
 * This util makes the wipe lossless — the editor can still re-position via the
 * panel afterward, but no images are lost.
 */
export function preserveImagesAcrossRefine(
  oldContent: string,
  newContent: string,
): { content: string; preservedCount: number; appendedCount: number } {
  const oldSlots = extractSlots(oldContent)
  if (oldSlots.length === 0) return { content: newContent, preservedCount: 0, appendedCount: 0 }

  const oldHeadings = extractH2Headings(oldContent)

  // Map: heading text → array of slot raw HTML that followed that heading.
  const slotsByHeading = new Map<string, string[]>()
  const orphanSlots: string[] = []  // slots that appeared before any H2

  for (const slot of oldSlots) {
    let nearest: { text: string; end: number } | null = null
    for (const h of oldHeadings) {
      if (h.end <= slot.start && (!nearest || h.end > nearest.end)) {
        nearest = { text: h.text, end: h.end }
      }
    }
    if (nearest) {
      const arr = slotsByHeading.get(nearest.text) ?? []
      arr.push(slot.raw)
      slotsByHeading.set(nearest.text, arr)
    } else {
      orphanSlots.push(slot.raw)
    }
  }

  let next = newContent
  let preserved = 0

  // Orphan slots (pre-heading) → prepend to refined content
  if (orphanSlots.length > 0) {
    next = orphanSlots.join('\n\n') + '\n\n' + next
    preserved += orphanSlots.length
  }

  // For each old heading that still exists in the refined content, splice
  // its slots in after the matching heading. Insert as a single combined
  // chunk to preserve original order.
  for (const [text, slots] of Array.from(slotsByHeading.entries())) {
    const idx = extractH2Headings(next).findIndex((h) => h.text === text)
    if (idx >= 0) {
      next = insertAtPosition(next, slots.join('\n\n'), { kind: 'afterHeading', index: idx })
      preserved += slots.length
      slotsByHeading.delete(text)
    }
  }

  // Anything still unmatched (heading text changed) → append at end.
  let appended = 0
  for (const slots of Array.from(slotsByHeading.values())) {
    for (const raw of slots) {
      next = next + '\n\n' + raw
      appended++
      preserved++
    }
  }

  return { content: next, preservedCount: preserved, appendedCount: appended }
}

/** Insert raw HTML markup at a chosen position. */
export function insertAtPosition(content: string, markup: string, position: InsertPosition): string {
  const sep = '\n\n'
  if (position.kind === 'start') {
    return markup + sep + content
  }
  if (position.kind === 'end') {
    return content + sep + markup
  }
  const headings = extractH2Headings(content)
  const h = headings[position.index]
  if (!h) return content + sep + markup
  return content.slice(0, h.end) + sep + markup + content.slice(h.end)
}
