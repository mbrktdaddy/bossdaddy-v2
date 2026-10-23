import { extractH2Headings, insertAtPosition } from '@/lib/inlineImages'
import { PRESERVED_BLOCK_RE } from './sections'

// Whole-document refines rebuild the prose and lose every non-prose block.
// `preserveImagesAcrossRefine` (lib/inlineImages.ts) solved it for figures;
// this is the same move for everything block-level — figures, galleries,
// collection embeds, cross-link cards — keyed by the H2 each block followed.

export interface PreserveResult {
  content: string
  preservedCount: number
  appendedCount: number
}

export function preserveBlocksAcrossRefine(oldContent: string, newContent: string): PreserveResult {
  const blocks: { raw: string; start: number }[] = []
  const re = new RegExp(PRESERVED_BLOCK_RE.source, PRESERVED_BLOCK_RE.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(oldContent)) !== null) blocks.push({ raw: m[0], start: m.index })
  if (blocks.length === 0) return { content: newContent, preservedCount: 0, appendedCount: 0 }

  const oldHeadings = extractH2Headings(oldContent)
  const byHeading = new Map<string, string[]>()
  const orphans: string[] = []
  for (const b of blocks) {
    let nearest: { text: string; end: number } | null = null
    for (const h of oldHeadings) {
      if (h.end <= b.start && (!nearest || h.end > nearest.end)) nearest = { text: h.text, end: h.end }
    }
    if (nearest) byHeading.set(nearest.text, [...(byHeading.get(nearest.text) ?? []), b.raw])
    else orphans.push(b.raw)
  }

  let next = newContent
  let preserved = 0
  if (orphans.length) {
    next = orphans.join('\n\n') + '\n\n' + next
    preserved += orphans.length
  }
  for (const [text, raws] of Array.from(byHeading.entries())) {
    const idx = extractH2Headings(next).findIndex((h) => h.text === text)
    if (idx >= 0) {
      next = insertAtPosition(next, raws.join('\n\n'), { kind: 'afterHeading', index: idx })
      preserved += raws.length
      byHeading.delete(text)
    }
  }
  let appended = 0
  for (const raws of Array.from(byHeading.values())) {
    for (const raw of raws) { next = next + '\n\n' + raw; appended++; preserved++ }
  }
  return { content: next, preservedCount: preserved, appendedCount: appended }
}
