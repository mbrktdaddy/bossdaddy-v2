import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 30

const Input = z.object({
  text:        z.string().min(1).max(4000),
  instruction: z.string().min(3).max(500),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success } = await checkRateLimit(`refine-selection:${user.id}`, 'claude-aux')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { text, instruction } = parsed.data

  const result = await getClaudeClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    system: 'You are an editor. The user provides an excerpt and an instruction. Return ONLY the revised text — no preamble, no explanation, no quotes. Preserve any HTML tags that were in the original.',
    messages: [{
      role: 'user',
      content: `Instruction: ${instruction}\n\nExcerpt:\n${text}`,
    }],
  }).catch((err: unknown) => ({ _error: err instanceof Error ? err.message : String(err) } as const))

  if ('_error' in result) {
    return NextResponse.json({ error: `AI error: ${result._error.slice(0, 120)}` }, { status: 502 })
  }

  const refined = result.content.find((b) => b.type === 'text')?.text?.trim() ?? ''

  // Log the before/after for the voice-learning flywheel (Phase 3 will mine
  // these to distill recurring edits into proposed phrases). Awaited (not
  // fire-and-forget) because on serverless the function can be reclaimed right
  // after the response flushes, dropping a detached write — and this log IS the
  // training signal, so a silent drop defeats the point. A logging failure must
  // never break the refine, so errors are swallowed. Skip no-op refines.
  if (refined && refined !== text.trim()) {
    const { error: logErr } = await supabase
      .from('voice_edits')
      .insert({
        user_id: user.id,
        content_type: 'selection',
        before: text,
        after: refined,
        refine_instruction: instruction,
      })
    if (logErr) console.error('voice_edits log failed:', logErr.message)
  }

  return NextResponse.json({ refined })
}
