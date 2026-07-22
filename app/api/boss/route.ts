import type { ModelMessage } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getEntitlements } from '@/lib/boss/entitlements'
import { buildBossConciergeSystemBlocks } from '@/lib/boss/prompt'
import { runBossAgent } from '@/lib/boss/agent'
import { BOSS_TOOLS } from '@/lib/boss/tools'
import type { Block, BossStreamEvent } from '@/lib/boss/types'

// Streaming keeps the connection open for the turn. Most turns are short, but the
// gap-fallback research_gear tool fires Anthropic web_search synchronously inside
// the turn (the user waits with a "Researching…" indicator rather than the chat
// breaking into a poll), so keep real headroom under the Pro cap.
export const maxDuration = 200

const HISTORY_CAP = 12

const BodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  context: z.string().max(500).optional(),
  // Visitors (no account) carry their own short history; members load it server-side.
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .max(HISTORY_CAP)
    .optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const entitlements = await getEntitlements(user?.id ?? null)

  // Rate limit: members by user id, visitors by IP (the free-taste quota).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const rlId = user ? `boss:${user.id}` : `boss-anon:${ip}`
  const { success } = await checkRateLimit(rlId, entitlements.bossRateKey)
  if (!success) {
    // Visitors out of free turns → signup CTA; members → soft limit message.
    const event: BossStreamEvent = user
      ? { type: 'error', message: "You've hit your limit for now. Take a breather and come back in a bit." }
      : { type: 'quota_exhausted' }
    return sse(singleEvent(event))
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { message, conversationId, context, history } = parsed.data

  // Build the running message list.
  let priorTurns: ModelMessage[] = []
  let activeConversationId: string | null = null

  if (user) {
    // Resolve/validate conversation ownership (RLS only returns the user's own).
    if (conversationId) {
      const { data: conv } = await supabase
        .from('boss_conversations')
        .select('id')
        .eq('id', conversationId)
        .maybeSingle()
      if (conv) activeConversationId = conv.id
    }
    if (activeConversationId) {
      const { data: rows } = await supabase
        .from('boss_messages')
        .select('role, content')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true })
        .limit(HISTORY_CAP * 2)
      priorTurns = (rows ?? []).map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
    }
  } else {
    priorTurns = (history ?? []).map((h) => ({ role: h.role, content: h.content }))
  }

  const userContent = context ? `(Context the user is viewing: ${context})\n\n${message}` : message
  const messages: ModelMessage[] = [
    ...priorTurns,
    { role: 'user', content: userContent },
  ]

  const system = await buildBossConciergeSystemBlocks(supabase, user?.id ?? null, {
    personalize: entitlements.personalize,
  })

  const ctx = { supabase, userId: user?.id ?? null, entitlements }

  const encoder = new TextEncoder()
  let assistantText = ''
  const blocks: Block[] = []
  const toolNames: string[] = []

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: BossStreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      try {
        for await (const ev of runBossAgent({ system, messages, tools: BOSS_TOOLS, ctx })) {
          if (ev.type === 'text') assistantText += ev.delta
          // `blocks` is the current channel; `citations` is the legacy event name
          // (kept on the union until the last producer drops it).
          if (ev.type === 'blocks' || ev.type === 'citations') blocks.push(...ev.items)
          if (ev.type === 'tool_start') toolNames.push(ev.name)

          if (ev.type === 'done') {
            let messageId: string | null = null
            let convId: string | null = activeConversationId
            if (user && entitlements.persistHistory && assistantText.trim()) {
              const res = await persistTurn({
                supabase,
                userId: user.id,
                conversationId: activeConversationId,
                userMessage: message,
                assistantText,
                blocks,
                toolNames,
              })
              messageId = res.messageId
              convId = res.conversationId
            }
            send({ type: 'done', messageId, conversationId: convId })
          } else {
            send(ev)
          }
        }
      } catch {
        send({ type: 'error', message: 'The Boss hit a snag. Give it another shot in a sec.' })
      } finally {
        controller.close()
      }
    },
  })

  return sse(stream)
}

function sse(body: ReadableStream<Uint8Array>) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

function singleEvent(event: BossStreamEvent): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      controller.close()
    },
  })
}

// Persist a member turn (user + assistant messages), creating the conversation on
// the first turn. Uses the RLS-scoped client so a policy gap fails closed. Returns
// the assistant message id (best-effort; null if the write fails).
async function persistTurn(opts: {
  supabase: SupabaseClient
  userId: string
  conversationId: string | null
  userMessage: string
  assistantText: string
  blocks: Block[]
  toolNames: string[]
}): Promise<{ conversationId: string | null; messageId: string | null }> {
  const { supabase, userId } = opts
  try {
    let conversationId = opts.conversationId
    if (!conversationId) {
      const title = opts.userMessage.slice(0, 80)
      const { data: conv, error } = await supabase
        .from('boss_conversations')
        .insert({ user_id: userId, title })
        .select('id')
        .single()
      if (error || !conv) return { conversationId: null, messageId: null }
      conversationId = conv.id
    } else {
      await supabase.from('boss_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
    }

    await supabase.from('boss_messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: opts.userMessage,
    })

    const { data: assistantRow } = await supabase
      .from('boss_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: opts.assistantText,
        // Persisted in the existing `citations` jsonb column (Block[]); the
        // renderer reads both the historical and new block shapes.
        citations: opts.blocks.length ? opts.blocks : null,
        tool_calls: opts.toolNames.length ? opts.toolNames.map((name) => ({ name })) : null,
      })
      .select('id')
      .single()

    return { conversationId, messageId: assistantRow?.id ?? null }
  } catch {
    return { conversationId: null, messageId: null }
  }
}
