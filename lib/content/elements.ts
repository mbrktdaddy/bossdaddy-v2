import { z } from 'zod'

// Typed body elements (docs/rich-elements-plan.md §3). The model never writes
// their HTML: the outline RECOMMENDS one (type + where + why), the blocks stage
// DRAFTS its content from the finished prose, `elementToHtml` (lib/content/html.ts)
// serialises it as a marker div the sanitizer allows and globals.css styles,
// and the Tiptap nodes keep it editable. Public pages render the HTML as-is
// (CSS-driven, like galleries) — only HowTo JSON-LD needs `extractSteps`.
//
// Registry: add a type here (kind/schema/serialiser/parser), a Tiptap node, a
// sanitizer class, and CSS. Nothing else knows the list.

export const ELEMENT_TYPES = ['callout', 'steps', 'facts', 'timeline'] as const
export type ElementType = (typeof ELEMENT_TYPES)[number]

export const CALLOUT_KINDS = ['tip', 'warning', 'safety', 'faith', 'note'] as const
export type CalloutKind = (typeof CALLOUT_KINDS)[number]

/** The default kicker per kind — the author can retitle it (`data-title`). */
export const CALLOUT_LABEL: Record<CalloutKind, string> = {
  tip: 'Tip',
  warning: 'Watch out',
  safety: 'Safety',
  faith: 'Faith note',
  note: 'Note',
}

export const STEPS_DEFAULT_TITLE = 'Steps at a glance'
export const FACTS_DEFAULT_TITLE = 'Key facts'
export const TIMELINE_DEFAULT_TITLE = 'How it went'

/** Display name per type (outline editor, kickers). */
export const ELEMENT_LABEL: Record<ElementType, string> = {
  callout: 'Callout',
  steps: 'Steps box',
  facts: 'Key facts',
  timeline: 'Timeline',
}

/** The outline's recommendation: what, where, why. The author toggles each. */
export interface ElementPlan {
  type: ElementType
  /** Exact H2 text of the part it follows; '' = after the introduction. */
  afterHeading: string
  reason: string
}

export interface CalloutElement {
  type: 'callout'
  afterHeading: string
  kind: CalloutKind
  title: string
  /** 1–3 sentences; light inline marks allowed. */
  body: string
}

export interface StepsElement {
  type: 'steps'
  afterHeading: string
  title: string
  /** Plain "about 20 minutes" or null. */
  time: string | null
  items: { title: string; body: string }[]
}

export interface FactsElement {
  type: 'facts'
  afterHeading: string
  title: string
  /** Label / value pairs the prose states (price paid, weight, time tested…). */
  items: { label: string; value: string }[]
}

export interface TimelineElement {
  type: 'timeline'
  afterHeading: string
  title: string
  /** Dated sequence the prose narrates, in order. */
  items: { when: string; title: string; body: string }[]
}

export type ContentElement = CalloutElement | StepsElement | FactsElement | TimelineElement

// ── Model output (blocks stage) ─────────────────────────────────────────────
// One flat shape rather than a union: structured output is far more reliable
// with optional fields than with discriminators, and `normalizeElement` is
// where the per-type rules are enforced.

export const ElementDraftOutput = z.object({
  type:         z.enum(ELEMENT_TYPES),
  afterHeading: z.string().max(200).describe('Copy the planned placement exactly ("" = after the introduction)'),
  kind:         z.enum(CALLOUT_KINDS).optional().describe('callout only: tip | warning | safety | faith | note'),
  title:        z.string().max(60).describe('callout: a 1–4 word kicker ("Watch out", "Before you buy"); steps: a short box title'),
  body:         z.string().max(600).optional().describe('callout only: 1–3 sentences lifted from the prose — the one thing a skimmer must not miss'),
  time:         z.string().max(40).nullable().optional().describe('steps only: total time in plain words if the prose states it, else null'),
  items:        z.array(z.object({
    title: z.string().min(1).max(80).describe('The action, imperative, 2–6 words'),
    body:  z.string().max(300).describe('One sentence of the how or the why, from the prose'),
  })).max(10).optional().describe('steps only: 3–8 steps in the order the reader performs them'),
  facts:        z.array(z.object({
    label: z.string().min(1).max(40).describe('"Price paid", "Weight", "Tested for"…'),
    value: z.string().min(1).max(120).describe('Exactly what the prose or the author facts state — never a spec from memory'),
  })).max(10).optional().describe('facts only: 3–8 label / value pairs the piece actually states'),
  events:       z.array(z.object({
    when:  z.string().min(1).max(40).describe('"Day 1", "Week 3", "Month 6", "Winter"… as the prose puts it'),
    title: z.string().min(1).max(80).describe('What happened, 2–8 words'),
    body:  z.string().max(300).describe('One sentence from the prose, or empty'),
  })).max(10).optional().describe('timeline only: 3–8 moments in order, each one the prose narrates'),
})
export type ElementDraftOutputT = z.infer<typeof ElementDraftOutput>

/** Turn a model draft into a ContentElement, or null when it doesn't hold up. */
export function normalizeElement(d: ElementDraftOutputT): ContentElement | null {
  const afterHeading = d.afterHeading.trim()
  if (d.type === 'callout') {
    const body = (d.body ?? '').trim()
    if (!body) return null
    const kind: CalloutKind = d.kind && (CALLOUT_KINDS as readonly string[]).includes(d.kind) ? d.kind : 'note'
    return { type: 'callout', afterHeading, kind, title: d.title.trim() || CALLOUT_LABEL[kind], body }
  }
  if (d.type === 'facts') {
    const items = (d.facts ?? []).map((f) => ({ label: f.label.trim(), value: f.value.trim() })).filter((f) => f.label && f.value)
    if (items.length < 2) return null
    return { type: 'facts', afterHeading, title: d.title.trim() || FACTS_DEFAULT_TITLE, items }
  }
  if (d.type === 'timeline') {
    const items = (d.events ?? []).map((e) => ({ when: e.when.trim(), title: e.title.trim(), body: e.body.trim() })).filter((e) => e.when && e.title)
    if (items.length < 2) return null
    return { type: 'timeline', afterHeading, title: d.title.trim() || TIMELINE_DEFAULT_TITLE, items }
  }
  const items = (d.items ?? []).map((i) => ({ title: i.title.trim(), body: i.body.trim() })).filter((i) => i.title)
  if (items.length < 2) return null
  return { type: 'steps', afterHeading, title: d.title.trim() || STEPS_DEFAULT_TITLE, time: d.time?.trim() || null, items }
}

// ── Stored HTML → facts ─────────────────────────────────────────────────────

const ELEMENT_RE = /<div\b[^>]*\bclass="bd-(callout|steps|facts|timeline)"[^>]*>([\s\S]*?)<\/div>/gi

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))
  return m ? decode(m[1]) : null
}

function decode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

function textOf(html: string): string {
  return decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export interface ExtractedSteps {
  title: string
  time: string | null
  items: { name: string; text: string }[]
}

/** Every steps element in the body, as plain text — the HowTo JSON-LD source. */
export function extractSteps(html: string | null | undefined): ExtractedSteps[] {
  if (!html) return []
  const out: ExtractedSteps[] = []
  for (const m of html.matchAll(new RegExp(ELEMENT_RE.source, ELEMENT_RE.flags))) {
    if (m[1] !== 'steps') continue
    const open = m[0].slice(0, m[0].indexOf('>') + 1)
    const items: { name: string; text: string }[] = []
    for (const li of m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const strong = li[1].match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)
      const name = strong ? textOf(strong[1]).replace(/[.:]\s*$/, '') : ''
      const rest = strong ? textOf(li[1].replace(strong[0], '')) : textOf(li[1])
      if (name || rest) items.push({ name: name || rest, text: rest || name })
    }
    if (items.length) out.push({ title: attr(open, 'data-title') ?? STEPS_DEFAULT_TITLE, time: attr(open, 'data-time'), items })
  }
  return out
}

/** True when a callout or steps box carries no readable text (an abandoned insert). */
export function hasEmptyElements(html: string | null | undefined): boolean {
  if (!html) return false
  for (const m of html.matchAll(new RegExp(ELEMENT_RE.source, ELEMENT_RE.flags))) {
    if (!textOf(m[2])) return true
  }
  return false
}

/** Render-time safety net: drop empty element boxes. */
export function stripEmptyElements(html: string): string {
  return html.replace(new RegExp(ELEMENT_RE.source, ELEMENT_RE.flags), (m, _t, inner: string) => (textOf(inner) ? m : ''))
}

export const EMPTY_ELEMENTS_MESSAGE =
  'This piece has an empty callout or steps box. Fill it in or delete it before it can go live.'
