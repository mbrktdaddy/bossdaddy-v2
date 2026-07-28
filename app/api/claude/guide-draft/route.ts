import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { fetchTagVocabulary, tagSlugList } from '@/lib/claude/tag-vocab'
import { isInquiryCategory } from '@/lib/categories'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// Deep guides generate up to 8000 tokens (5–8 long sections + blocks), which can
// take 1–2 min under load; 90s was cutting it close for the comprehensive tier.
// 300s = Vercel's current per-function ceiling. See the note in
// app/api/claude/draft/route.ts — the guide path measured slower than the review
// path (125s at opus-5/high), so it has less margin, not more.
export const maxDuration = 300

// Piece-type depth toggle (Decision A, 2026-07-05). Drives the generated
// structure, which structured content blocks are forced, AND the token budget:
//   essay → free-form narrative, no forced TL;DR/takeaways/FAQ, tight budget
//   howto → tight + scannable, TL;DR + key takeaways, no forced FAQ
//   guide → comprehensive (all blocks), long-form budget
type PieceType = 'essay' | 'howto' | 'guide'

// The model output is validated against this schema — the SDK enforces it
// instead of us regex-parsing JSON from text. Built per piece type so
// essays/how-tos aren't forced to emit blocks that would break their voice
// (and burn tokens the wizard then discards).
function buildGuideSchema(pieceType: PieceType): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title:           { type: 'string' },
    excerpt:         { type: 'string' },
    introduction:    { type: 'string' },
    sections:        { type: 'array', items: {
      type: 'object',
      properties: { heading: { type: 'string' }, body: { type: 'string' } },
      required: ['heading', 'body'],
    } },
    conclusion:      { type: 'string' },
    heroImagePrompt: { type: 'string' },
    inlineImages:    { type: 'array', items: {
      type: 'object',
      properties: {
        afterHeading: { type: 'string' }, prompt: { type: 'string' },
        altText: { type: 'string' }, caption: { type: 'string' },
      },
      required: ['afterHeading', 'prompt', 'altText', 'caption'],
    } },
    suggestedTags:   { type: 'array', items: { type: 'string' } },
  }

  const tldr = { type: 'string' }
  const keyTakeaways = { type: 'array', items: { type: 'string' } }
  const faqs = { type: 'array', items: {
    type: 'object',
    properties: { question: { type: 'string' }, answer: { type: 'string' } },
    required: ['question', 'answer'],
  } }

  // Which structured content blocks this piece type includes (and forces).
  const blocks: Record<string, unknown> =
    pieceType === 'essay' ? {} :
    pieceType === 'howto' ? { tldr, keyTakeaways } :
    { tldr, keyTakeaways, faqs }

  const commonRequired = [
    'title', 'excerpt', 'introduction', 'sections',
    'conclusion', 'heroImagePrompt', 'inlineImages', 'suggestedTags',
  ]

  return {
    type: 'object',
    properties: { ...base, ...blocks },
    required: [...commonRequired, ...Object.keys(blocks)],
  }
}

const GuideDraftInput = z.object({
  topic: z.string().min(4).max(150),
  category: z.string().min(2).max(80),
  pieceType: z.enum(['essay', 'howto', 'guide']).default('guide'),
  keyPoints: z.array(z.string()).max(15).default([]),
  context: z.string().max(6000).optional(),
  targetAudience: z.string().max(200).optional(),
  productSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(15).optional(),
  // 'auto' lets Claude pick (2–3 images); a number forces exactly that many.
  imageSlots: z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto'),
  // Inquiry register (student-first, Socratic) for philosophical/moral topics —
  // meaning, purpose, faith and doubt, the existence of God. Omitted means "use
  // the category default" (on for table-duty/watch-duty); an explicit boolean
  // from the wizard always wins in either direction.
  inquiryMode: z.boolean().optional(),
})

// Per-type prompt fragments + token budget. Deep guides get the long budget;
// essays/how-tos stay tight (which is also the point — scannable, not padded).
const PIECE_CONFIG: Record<PieceType, {
  label: string
  maxTokens: number
  structure: string
  contentBlocks: string
  fieldGuidanceBlocks: string
}> = {
  // maxTokens raised ~50% across all three piece types for the 5 generation: it
  // tokenizes ~30% heavier for the same prose, and adaptive thinking now shares
  // this budget with the answer text. See app/api/claude/draft/route.ts.
  essay: {
    label: 'personal essay',
    maxTokens: 5700,
    structure: `STRUCTURE (personal essay — narrative, first-person, voice-forward):
- Introduction: open inside a real moment or memory that pulls the reader in — no throat-clearing, no "in this article".
- Sections: 4–7 flowing sections that move the story or argument forward. Each has a heading and 150–300 words of prose. Let paragraphs breathe — this is not a listicle.
- Conclusion: 1–2 paragraphs that land the reflection honestly, without a bow on top.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: '',
    fieldGuidanceBlocks: '',
  },
  howto: {
    label: 'how-to guide',
    maxTokens: 5700,
    structure: `STRUCTURE (how-to — tight and scannable):
- Introduction: 2–3 sentences naming the problem and what the reader will be able to do.
- Sections: 3–5 sections, each 120–200 words, each a clear step or decision with a concrete takeaway. Keep paragraphs short — a time-poor dad should be able to skim it on a phone.
- Conclusion: 1–2 sentences with the single most important next step.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: `CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 2–3 sentence plain-English summary for skimmers. Lead with the main takeaway.
- keyTakeaways: 3–5 specific, actionable bullet points readers can act on immediately.`,
    fieldGuidanceBlocks: ' tldr is 2–3 plain-English skimmer sentences; keyTakeaways are 3–5 specific, actionable items;',
  },
  guide: {
    label: 'guide',
    maxTokens: 12000,
    structure: `STRUCTURE (comprehensive guide):
- Introduction: 2–3 sentences that hook the reader with a real scenario (first-person dad).
- Sections: 5–8 sections, each 200–350 words, each with a clear practical takeaway. Cover the topic thoroughly — the reader shouldn't need to open another article.
- Conclusion: 1–2 paragraphs with a specific next step or recommendation.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: `CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 2–3 sentence plain-English summary for skimmers. Lead with the main takeaway.
- keyTakeaways: 3–5 specific, actionable bullet points. Not a rehash of the intro — highlight the most useful or surprising insights.
- faqs: 3–5 Q&A pairs covering the most common questions on this topic. Write questions the way a real dad searching Google would phrase them. Answers 2–3 sentences each.`,
    fieldGuidanceBlocks: ' tldr is 2–3 plain-English skimmer sentences; keyTakeaways are 3–5 specific, actionable items; faqs are 3–5 question/answer pairs (answers 2–3 sentences);',
  },
}

// Inquiry-register overlay. Same schema, same piece types, same token budgets —
// only the framing changes, because the default framing is takeaway-first and
// actively wrong for a question about meaning or God ("3–5 actionable bullet
// points readers can act on immediately" is a category error on a moral
// question). The structured blocks stay in the schema so the wizard, the DB
// shape and the public guide page are untouched; they're just re-pointed at
// question-shaped content. Register doctrine lives in BOSS_DADDY_SYSTEM's
// INQUIRY REGISTER block — this only supplies the per-piece-type structure.
const INQUIRY_CONFIG: Record<PieceType, Pick<
  (typeof PIECE_CONFIG)[PieceType], 'label' | 'structure' | 'contentBlocks' | 'fieldGuidanceBlocks'
>> = {
  essay: {
    label: 'personal essay',
    structure: `STRUCTURE (personal essay, inquiry register — narrative, first-person, thinking out loud):
- Introduction: open inside the real moment, memory or conversation that put this question in front of you. Name the question plainly. No throat-clearing, no "in this article".
- Sections: 4–7 flowing sections that move the thinking forward — each a genuine step in the reasoning, not a restatement. Somewhere in there, give the strongest opposing view a fair hearing. Each 150–300 words of prose; let paragraphs breathe.
- Conclusion: 1–2 paragraphs that commit to your best answer and say plainly why you find it convincing. Be honest about any piece that stays unsettled, but don't end on a shrug.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: '',
    fieldGuidanceBlocks: '',
  },
  howto: {
    label: 'short discussion piece',
    structure: `STRUCTURE (short discussion, inquiry register — tight but honest):
- Introduction: 2–3 sentences naming the question and why it lands at the family table.
- Sections: 3–5 sections, each 120–200 words, each one move in the thinking. One of them should give the strongest opposing view a fair hearing. Short paragraphs — a tired dad should be able to follow it on a phone.
- Conclusion: 1–2 sentences committing to your best answer, held honestly.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: `CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 2–3 sentences naming the question and the answer you land on. Lead with the answer, not with the fact that it's complicated.
- keyTakeaways: 3–5 load-bearing ideas, distinctions or conclusions worth carrying away. These can absolutely include what you decided — they just aren't gear-style action items.`,
    fieldGuidanceBlocks: ' tldr names the question and the answer you land on; keyTakeaways are 3–5 ideas or conclusions worth carrying away;',
  },
  guide: {
    label: 'long-form discussion piece',
    structure: `STRUCTURE (long-form discussion, inquiry register):
- Introduction: 2–3 sentences that put the reader inside a real scenario where this question actually bites (first-person dad). Name the question.
- Sections: 5–8 sections, each 200–350 words, each advancing the argument one real step — the tension, the distinctions that matter, what the best thinking on this already establishes, where the easy answers break down. One section should give the strongest opposing view a fair hearing before you answer it. Sections don't need a practical takeaway, but they do need to get somewhere.
- Conclusion: 1–2 paragraphs committing to your best answer and why you find it convincing, plus an honest note on whatever genuinely stays open. A sharper closing question is welcome after that, not in place of it.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: `CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 2–3 sentences naming the question and the answer you land on. Lead with the answer, not with the fact that it's complicated.
- keyTakeaways: 3–5 load-bearing ideas, distinctions, reframes or conclusions worth carrying away. These can absolutely include what you decided — they just aren't gear-style action items.
- faqs: 3–5 honest objections a thoughtful reader would raise, each in its strongest form and answered with an actual answer. Phrase them the way a sharp friend would push back, not the way a marketer sets up a softball.`,
    fieldGuidanceBlocks: ' tldr names the question and the answer you land on; keyTakeaways are 3–5 ideas or conclusions worth carrying away; faqs are 3–5 strongest-form objections, each given a real answer;',
  },
}

function inlineImagesInstruction(slots: number | 'auto'): string {
  if (slots === 0) {
    return 'INLINE IMAGES:\n- Do not include any inline images. Return an empty array for "inlineImages".'
  }
  if (slots === 'auto') {
    return `INLINE IMAGES:
- Suggest 2–3 inline image placements that would meaningfully improve the article. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short editorial sentence readers see under the image — human, not a restatement of the alt. Under 100 chars.`
  }
  return `INLINE IMAGES:
- Suggest exactly ${slots} inline image placement${slots === 1 ? '' : 's'} that would meaningfully improve the article. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short editorial sentence readers see under the image — human, not a restatement of the alt. Under 100 chars.`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, remaining, reset } = await checkRateLimit(`guide-draft:${user.id}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining), 'X-RateLimit-Reset': String(reset) } }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = GuideDraftInput.safeParse(body)
  if (!parsed.success) {
    console.error('guide-draft validation failed:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { topic, category, pieceType, keyPoints, context, targetAudience, productSlugs, imageSlots, inquiryMode } = parsed.data

  // Explicit wizard toggle wins in either direction; otherwise the pillar decides.
  const inquiry = inquiryMode ?? isInquiryCategory(category)

  // Inquiry pieces carry no affiliate links — BOSS_DADDY_SYSTEM forbids [[BUY:]]
  // tokens in that register, so drop any selected slugs rather than send the
  // model a prompt that contradicts its own system rules. The wizard hides the
  // product picker in inquiry mode, so this is a backstop for direct API calls.
  const slugs = inquiry ? [] : (productSlugs ?? []).filter(Boolean)
  const brief = context?.trim()
  const cfg = inquiry
    ? { ...PIECE_CONFIG[pieceType], ...INQUIRY_CONFIG[pieceType] }
    : PIECE_CONFIG[pieceType]

  // DB-driven tag vocabulary (killed the hardcoded slug list that used to drift).
  const tagVocab = await fetchTagVocabulary(supabase)

  // The literal "INQUIRY MODE: ON" line is the trigger the INQUIRY REGISTER
  // block in BOSS_DADDY_SYSTEM keys off — don't reword it.
  const inquiryHeader = inquiry
    ? `INQUIRY MODE: ON

This is a discussion piece, not a gear piece. Apply the INQUIRY REGISTER from your system prompt: humble in posture, decisive in substance. Reason out loud so the reader can follow and disagree, give the strongest opposing view a fair hearing — and then commit to your best answer. Draw on what philosophy, theology, psychology and plain hard-won experience already establish here; say where thoughtful opinion lands and which view convinces you. Honest uncertainty about a specific piece is fine; hedging the whole essay is not. The gear CONTENT PILLARS are suspended and there are no product links in this piece.

`
    : ''

  const prompt = `${inquiryHeader}Write a dad-focused ${cfg.label} on this topic:

Topic: ${topic}
Category: ${category}${keyPoints.length ? `\nKey Points: ${keyPoints.join(', ')}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${slugs.length ? `\nProduct slugs: ${slugs.join(', ')}` : ''}
${brief ? `
AUTHOR'S BRIEF / SOURCE MATERIAL (required — ground the piece in these specifics):
"""
${brief}
"""
- Treat the brief as the author's real, first-hand context. Use its specific facts, numbers, names, and personal details — do not invent competing ones or contradict them.
- Write in this author's voice and from their lived experience as described. Weave the concrete specifics (figures, brand names, the personal arc) into the prose rather than restating them as a list.
- If the brief implies a story or progression, honor that narrative arc.
` : ''}
${cfg.structure}

${cfg.contentBlocks ? `${cfg.contentBlocks}\n\n` : ''}SEO: Include the main topic phrase naturally in the intro and at least one section heading.

${inlineImagesInstruction(imageSlots)}

TAGS: Pick 3–6 slugs from this controlled vocabulary that best describe this piece. Be selective — only tag what genuinely applies.
Editorial (pick at most 1): top-pick, best-value, hidden-gem
Life Stage: ${tagSlugList(tagVocab, 'life-stage')}
Use Case: ${tagSlugList(tagVocab, 'use-case')}
Topic: ${tagSlugList(tagVocab, 'topic')}

Return your result by calling the submit_guide tool. Field guidance: title is a specific, useful title (max 80 chars, include the topic keyword); excerpt is one punchy card sentence (max 160 chars);${cfg.fieldGuidanceBlocks} introduction opens the piece per the structure above; each section has a clear heading and a body with paragraphs separated by \\n\\n; conclusion follows the structure above (separate paragraphs with \\n\\n); heroImagePrompt is an editorial-photography hero prompt (specific real-world objects, natural daylight or warm indoor light, no people, no text, under 180 chars); each inlineImages.afterHeading MUST match one of your section headings; suggestedTags are 3–6 slugs from the controlled vocabulary above.`

  const systemMessages = await buildBossDaddySystemMessages(supabase, user.id)
  let draft: Record<string, unknown>
  try {
    draft = await aiGenerateObject<Record<string, unknown>>({
      bucket: 'content',
      tag: 'guide-draft',
      schema: jsonSchema<Record<string, unknown>>(buildGuideSchema(pieceType)),
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: cfg.maxTokens,
      // Pinned rather than left to the provider default; deliberately not xhigh
      // (measured over this route's time budget on Sonnet 5). See lib/ai/client.ts.
      effort: 'high',
      temperature: 0.8,
      maxRetries: 4,
    })
  } catch (err: unknown) {
    const c = classifyClaudeError(err)
    console.error('guide-draft generation error:', c.kind, '-', c.detail)
    // Truncated output is a cut-off draft — unsafe to use; steer to trim the brief.
    if (c.kind === 'truncated') {
      return NextResponse.json({ error: 'The draft ran long and got cut off. Try again, or trim the brief and regenerate.' }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }

  // Extract the hero image prompt — return it so the form can pre-fill the
  // editable prompt field. Inline image prompts travel with the draft itself.
  const imagePrompt: string = (draft.heroImagePrompt as string)
    ?? (draft.imagePrompts as Record<string, string> | undefined)?.hero
    ?? `Photorealistic lifestyle photo for a dad-focused article about ${topic}, no people, objects and setting only`

  // Validate AI-suggested tags against the live controlled vocabulary so a
  // hallucinated or stale slug can't slip through to the picker / attach step.
  // `.in()` returns only slugs that actually exist; on query error we keep the
  // raw list (the picker only surfaces real tags anyway, so it's a soft gate).
  const rawTags = Array.isArray(draft.suggestedTags) ? (draft.suggestedTags as string[]) : []
  let suggestedTags = rawTags
  if (rawTags.length) {
    const { data: validTags } = await supabase.from('tags').select('slug').in('slug', rawTags)
    if (validTags) suggestedTags = validTags.map((t) => t.slug)
  }

  const { heroImagePrompt: _heroOmit, imagePrompts: _legacyOmit, suggestedTags: _tags, ...cleanDraft } = draft

  return NextResponse.json({ draft: cleanDraft, imagePrompt, suggestedTags, remaining })
}
