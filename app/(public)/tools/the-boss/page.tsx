import type { Metadata } from 'next'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { buildSocialMetadata } from '@/lib/og'
import type { Block } from '@/lib/boss/types'
import BossChat, { type BossMsg } from './_components/BossChat'
import PastChats, { type PastChat } from './_components/PastChats'

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: LABELS.tools.theBoss.pageTitle,
    description: LABELS.tools.theBoss.metaDescription,
    path: '/tools/the-boss',
    siteUrl,
    type: 'site',
    ogType: 'website',
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAST_CHATS_LIMIT = 50

// Members only. Visitors get a sign-in panel in place of the chat (the API
// refuses them too). Members get their saved conversations: ?c=<id> opens one.
export default async function TheBossPage({
  searchParams,
}: {
  searchParams?: Promise<{ context?: string; c?: string }>
}) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const params = (await searchParams) ?? {}
  const seedContext = params.context

  const header = (
    <header className="mb-5">
      <p className="text-xs uppercase tracking-widest font-semibold text-eyebrow mb-2">Ask the Boss</p>
      <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">{LABELS.tools.theBoss.full}</h1>
      <p className="mt-2 text-sm sm:text-base text-prose-muted leading-relaxed max-w-2xl">
        Straight answers on fixes, gear, plans, and dad life — ask it anything.
      </p>
    </header>
  )

  if (!user) {
    const back = seedContext ? `/tools/the-boss?context=${encodeURIComponent(seedContext)}` : '/tools/the-boss'
    const next = encodeURIComponent(back)
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {header}
        <div className="border border-soft rounded-2xl bg-surface-raised p-6 sm:p-8">
          <p className="text-base sm:text-lg font-bold text-prose">The Boss is for members.</p>
          <p className="mt-1.5 text-sm sm:text-base text-prose-muted leading-relaxed max-w-prose">
            A free account gets you in. Ask about a fix, a purchase, a weekend plan, a toast you have to
            give — and your chats are saved so you can pick up where you left off.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/register?next=${next}`}
              className="text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg px-4 py-3 min-h-[44px] inline-flex items-center transition-colors"
            >
              Create free account
            </Link>
            <Link
              href={`/login?next=${next}`}
              className="text-sm font-semibold text-accent hover:underline px-3 py-3 min-h-[44px] inline-flex items-center"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const requestedId = params.c && UUID_RE.test(params.c) ? params.c : null
  const [{ data: chats }, active] = await Promise.all([
    supabase
      .from('boss_conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(PAST_CHATS_LIMIT),
    requestedId ? loadConversation(supabase, requestedId) : Promise.resolve(null),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {header}
      <PastChats chats={(chats ?? []) as PastChat[]} activeId={active?.id ?? null} />
      {/* key: switching conversations (or back to a new chat) remounts the chat. */}
      <BossChat
        key={active?.id ?? 'new'}
        conversationId={active?.id ?? null}
        initialMessages={active?.messages ?? []}
        seedContext={active ? undefined : seedContext}
      />
    </div>
  )
}

// One saved conversation with its messages. RLS returns only the member's own
// rows, so a foreign or stale id resolves to null and the page opens a new chat.
async function loadConversation(
  supabase: SupabaseClient,
  id: string,
): Promise<{ id: string; messages: BossMsg[] } | null> {
  const { data: rows } = await supabase
    .from('boss_messages')
    .select('id, role, content, citations, feedback')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
  if (!rows?.length) return null
  return {
    id,
    messages: rows.map((r) => ({
      role: r.role as 'user' | 'assistant',
      content: r.content as string,
      citations: (r.citations as Block[] | null) ?? undefined,
      messageId: r.role === 'assistant' ? (r.id as string) : null,
      feedback: (r.feedback as 'up' | 'down' | null) ?? null,
    })),
  }
}
