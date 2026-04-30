import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { z } from 'zod'

export const maxDuration = 60

const RefineInput = z.object({
  title:       z.string().min(1).max(120),
  category:    z.string().min(1).max(80),
  content:     z.string().min(10),
  instruction: z.string().min(4).max(1000),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = RefineInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, category, content, instruction } = parsed.data

  // Strip HTML tags so Claude receives clean readable text — avoids nested-quote JSON breakage
  const plainText = content
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const prompt = `You are editing an existing Boss Daddy guide. Apply ONLY the requested changes — preserve everything else.

Title: ${title}
Category: ${category}

Current article text:
${plainText}

Refinement instructions: ${instruction}

Return JSON with this exact shape (same as a new draft):
{
  "title": "string — updated title if the instructions require it, otherwise keep the original",
  "excerpt": "string — updated excerpt if needed, otherwise keep original (max 160 chars)",
  "introduction": "string — the opening paragraph(s)",
  "sections": [
    { "heading": "string", "body": "string" }
  ],
  "conclusion": "string"
}

Important: Only change what the instructions specify. Keep the first-person dad voice throughout.`

  try {
    const claude = getClaudeClient()
    const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
    const message = await claude.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })

    const draft = JSON.parse(jsonMatch[0])
    return NextResponse.json({ draft })
  } catch (err) {
    console.error('Guide refine error:', err)
    return NextResponse.json({ error: 'Refinement failed' }, { status: 502 })
  }
}
