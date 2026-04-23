import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { z } from 'zod'

export const maxDuration = 30

const AltTextInput = z.object({
  image_url: z.string().url(),
  context:   z.string().max(300).optional().nullable(), // optional extra context (e.g. "Boss Daddy review of DeWalt drill")
})

// POST /api/claude/alt-text — generate accessible alt text for an image via Claude vision
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = AltTextInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { image_url, context } = parsed.data

  const instruction = `Write concise, accessible alt text for this image for a dad-focused lifestyle blog.

Requirements:
- 1 sentence, 10–20 words
- Describe what's visible — objects, setting, mood
- Do NOT start with "Image of" or "Picture of"
- Good for screen readers — clear, specific, factual
- No quotes, no markdown, just the plain alt text
${context ? `\nExtra context: ${context}` : ''}

Return ONLY the alt text, nothing else.`

  try {
    const message = await getClaudeClient().messages.create({
      model: MODEL,
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: image_url } },
          { type: 'text',  text: instruction },
        ],
      }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text?.trim() ?? ''
    // Strip leading/trailing quotes if Claude wraps the response
    const alt = text.replace(/^["'"""]|["'"""]$/g, '').trim()

    if (!alt) return NextResponse.json({ error: 'AI returned empty alt text' }, { status: 502 })
    return NextResponse.json({ alt })
  } catch (err) {
    console.error('Alt text generation failed:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Alt text generation failed: ${msg.slice(0, 140)}` }, { status: 502 })
  }
}
