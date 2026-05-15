import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 60

const Input = z.object({
  collectionType: z.enum(['general', 'best_of', 'gift_guide', 'comparison', 'stack']),
  title:          z.string().min(2).max(160),
  description:    z.string().max(500).optional().nullable(),
  itemReviewIds:  z.array(z.string().uuid()).min(2).max(8),
  // Refine mode: when present, Claude reshapes the existing HTML per the
  // instruction instead of generating from scratch.
  currentHtml:    z.string().max(10000).optional().nullable(),
  instruction:    z.string().max(500).optional().nullable(),
})

const FLAVOR_BRIEF: Record<string, string> = {
  comparison: 'A head-to-head matchup where readers want a clear winner per category. Open with the testing scenario, frame why these specific products are being compared, and tee up the scorecard that follows. Do not pick the winner here — the scorecard does that.',
  stack:      'A curated kit-for-a-purpose. Open with the use case (the dad scenario this kit solves), explain why these specific products belong together (the system, not the individual pieces), and tee up the lineup that follows.',
  best_of:    'A ranked Best Of list. Open with what it took to earn a spot, what was tested, who this list is for. Tee up the ranked picks that follow.',
  general:    'A curated pick list. Open with the editorial framing — what brings these picks together, what the reader gets from this list.',
  gift_guide: 'A gift guide for a specific occasion or recipient. Open with the gifting context, the receiver in mind, and tease the picks below.',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { success, remaining } = await checkRateLimit(`collection-intro:${user.id}`)
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded. 10 generations per hour.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { collectionType, title, description, itemReviewIds, currentHtml, instruction } = parsed.data
  const isRefine = Boolean(currentHtml && instruction)

  // Look up the linked reviews for context (product name + category + 4 sub-scores)
  const admin = createAdminClient()
  const { data: reviews } = await admin
    .from('reviews')
    .select('id, title, product_name, category, rating, excerpt, score_quality, score_value, score_ease, score_daily_use')
    .in('id', itemReviewIds)

  const reviewLines = (reviews ?? []).map((r) => {
    const subs = `Q${r.score_quality ?? '—'}/V${r.score_value ?? '—'}/E${r.score_ease ?? '—'}/D${r.score_daily_use ?? '—'}`
    return `• ${r.product_name} (${r.category}) — overall ${r.rating ?? '—'}/10, ${subs}. ${r.excerpt ?? ''}`.trim()
  }).join('\n')

  const flavorBrief = FLAVOR_BRIEF[collectionType] ?? FLAVOR_BRIEF.general

  const prompt = isRefine
    ? `Refine the editorial intro below per this instruction: "${instruction}"

CURRENT INTRO:
${currentHtml}

CONTEXT (do not summarize this back — use only to inform your refinement):
Title: ${title}
${description ? `Description: ${description}\n` : ''}Type: ${collectionType} — ${flavorBrief}

Products:
${reviewLines}

Return ONLY the refined HTML (1-3 short paragraphs in <p> tags). No commentary, no JSON wrapping, no preamble.`
    : `Write a 1-3 paragraph editorial intro for the following collection. Use the established Boss Daddy voice — first-person dad, no corporate speak, real testing language.

Type: ${collectionType} — ${flavorBrief}
Title: ${title}
${description ? `Tagline/description: ${description}\n` : ''}
Products in this collection (in the order the editor placed them):
${reviewLines}

REQUIREMENTS:
- 1 to 3 short paragraphs in <p>...</p> tags. No headings. No lists.
- Open with a real-life moment, scenario, or stake — not a summary of what follows.
- ${collectionType === 'comparison' ? 'Do NOT declare a winner here; the scorecard handles that.' : ''}
- ${collectionType === 'stack' ? 'Make the reader understand why this set of products belongs together, not just what each one does.' : ''}
- Avoid restating the title or the product names in the first sentence.
- 80-180 words total. Tight.

Return ONLY the HTML. No JSON wrapping, no commentary, no preamble.`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
  const claudeResult = await getClaudeClient().messages.create({
    model: MODEL,
    max_tokens: 800,
    system: systemBlocks,
    messages: [{ role: 'user', content: prompt }],
  }).catch((err: unknown) => {
    console.error('Claude API error (collection-intro):', err)
    return { _error: err instanceof Error ? err.message : String(err) } as const
  })

  if ('_error' in claudeResult) {
    return NextResponse.json({ error: `AI service error: ${claudeResult._error.slice(0, 120)}` }, { status: 502 })
  }

  let text = claudeResult.content.find((b) => b.type === 'text')?.text ?? ''
  text = text.trim()
  // Strip any accidental code fences
  text = text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  if (!text) {
    return NextResponse.json({ error: 'AI returned empty content. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ html: text, remaining })
}
