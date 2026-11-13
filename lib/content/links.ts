import { isPasteKey, referenceSourceName } from './references'
import type { Brief } from './pipeline/types'

// Source links in the body (docs/content-pipeline-plan.md §4a, 2026-11-13). The
// writer links a source the FIRST time a part names it, as a light-Markdown link
// `[Source name](url)`, and may use ONLY the addresses of the brief's read
// references — any other link is cut back to its text before the part is stored
// (`enforceSourceLinks`), so a made-up address can never reach the page. Product
// links stay [[BUY:]] tokens; a pasted source has no address and is named in
// words only. `inlineMarksToHtml` renders the link; `htmlToStructuredText` turns
// it back into Markdown so a refine keeps it.

/** `[text](https://…)` — the only link form the prose may carry. */
export const SOURCE_LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)"]+)\)/g

function canonical(url: string): string {
  try { return new URL(url).toString() } catch { return url }
}

/** The addresses the writer may link: read references that carried facts, links only. */
export function sourceLinkUrls(brief: Brief | null | undefined): Set<string> {
  const out = new Set<string>()
  for (const n of brief?.referenceNotes ?? []) {
    if (n.status === 'ok' && n.facts.length && !isPasteKey(n.url)) out.add(canonical(n.url))
  }
  return out
}

/**
 * "- Name: url" lines for a section prompt. With `citedBy` (the part's ref lines,
 * "fact (source: Name)"), only the sources that part actually cites are offered.
 */
export function sourceLinkLines(brief: Brief, citedBy?: readonly string[]): string {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const n of brief.referenceNotes ?? []) {
    if (n.status !== 'ok' || !n.facts.length || isPasteKey(n.url) || seen.has(n.url)) continue
    const name = referenceSourceName(n)
    if (citedBy && !citedBy.some((r) => r.includes(`(source: ${name})`))) continue
    seen.add(n.url)
    lines.push(`- ${name}: ${n.url}`)
  }
  return lines.join('\n')
}

/** Cut every link whose address is not on the allow-list back to its text. */
export function enforceSourceLinks(text: string, allowed: ReadonlySet<string>): string {
  return text.replace(SOURCE_LINK_RE, (m, label: string, url: string) => (allowed.has(canonical(url)) ? m : label))
}

/** The text with the ALLOWED links reduced to their text — what the raw-URL rule should inspect. */
export function withoutSourceLinks(text: string, allowed: ReadonlySet<string>): string {
  return text.replace(SOURCE_LINK_RE, (m, label: string, url: string) => (allowed.has(canonical(url)) ? label : m))
}
