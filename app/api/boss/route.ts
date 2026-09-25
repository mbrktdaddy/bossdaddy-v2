import type { ModelMessage } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getEntitlements } from '@/lib/boss/entitlements'
import { buildBossConciergeSystemBlocks } from '@/lib/boss/prompt'
import { runBossAgent } from '@/lib/boss/agent'
import type { BossStreamEvent, SourceBlock } from '@/lib/boss/types'

// Streaming keeps the connection open for the turn — one model call (plus live
// searches, or a Claude retry), and a long answer can take a minute or more.
export const maxDuration = 120

// Most recent turns (user + assistant pairs) replayed to the model each request.
const HISTORY_CAP = 12

const BodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  context: z.string().max(500).optional(),
})

// Members only: the page shows logged-out visitors a sign-in panel instead of the
// chat, and this route refuses them outright.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Sign in to ask the Boss.' }, { status: 401 })
  }
  const entitlements = await getEntitlements(supabase, user.id)

  // Hourly session window + daily spend cap, both keyed by member. The admin is
  // exempt (the account-wide Anthropic spend cap still applies to everyone).
  if (!entitlements.unlimited) {
    const rlId = `boss:${user.id}`
    const { success: withinWindow } = await checkRateLimit(rlId, entitlements.bossRateKey)
    const success = withinWindow && (await checkRateLimit(rlId, 'boss-daily')).success
    if (!success) {
      return sse(singleEvent({ type: 'error', message: "You've hit your limit for now. Take a breather and come back in a bit." }))
    }
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { message, conversationId, context } = parsed.data

  // Resolve/validate conversation ownership (RLS only returns the member's own),
  // then replay its most recent turns — newest first from the DB, flipped back
  // into chronological order for the model.
  let priorTurns: ModelMessage[] = []
  let activeConversationId: string | null = null
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
      .order('created_at', { ascending: false })
      .limit(HISTORY_CAP * 2)
    priorTurns = (rows ?? [])
      .reverse()
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
  }

  const userContent = context ? `(Context the user is viewing: ${context})\n\n${message}` : message
  const messages: ModelMessage[] = [
    ...priorTurns,
    { role: 'user', content: userContent },
  ]

  const system = await buildBossConciergeSystemBlocks(supabase, user.id)

  const encoder = new TextEncoder()
  let assistantText = ''
  let sources: SourceBlock[] = []

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: BossStreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      try {
        for await (const ev of runBossAgent({ system, messages })) {
          if (ev.type === 'text') assistantText += ev.delta
          if (ev.type === 'sources') sources = ev.sources

          if (ev.type === 'done') {
            let messageId: string | null = null
            let convId: string | null = activeConversationId
            if (assistantText.trim()) {
              const res = await persistTurn({
                supabase,
                userId: user.id,
                conversationId: activeConversationId,
                userMessage: message,
                assistantText,
                sources,
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
  sources: SourceBlock[]
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
        // Source cards ride the existing `citations` jsonb column (Block[]), so a
        // reopened chat shows the same sources.
        citations: opts.sources.length ? opts.sources : null,
      })
      .select('id')
      .single()

    return { conversationId, messageId: assistantRow?.id ?? null }
  } catch {
    return { conversationId: null, messageId: null }
  }
}
