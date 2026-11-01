import { NextResponse, type NextRequest } from 'next/server'
import type { ModelMessage } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { aiGenerateObjectWithMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { MODELS } from '@/lib/ai/models'
import { isRenderableImageUrl } from '@/lib/images/remote-hosts'
import {
  AssistInput,
  AssistOutput,
  buildAssistSystem,
  buildAssistUser,
  promptCount,
  resolveAssistContext,
  settleAspect,
  sniffImageType,
  type AssistResult,
  type ImageMediaType,
  type PieceRow,
} from '@/lib/images/prompt-assist'
import { checkRateLimit } from '@/lib/rate-limit'

// A short text call (plus one photo in `describe` mode) at effort 'low'. The
// cap is for the photo fetch and a slow gateway, not the model: typical runs are
// a few seconds.
export const maxDuration = 60

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const PHOTO_TIMEOUT_MS = 10_000

type Photo = { bytes: Uint8Array; mediaType: ImageMediaType }

/** Read a body but give up the moment it passes `max` bytes, even with no Content-Length. */
async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  if (!res.body) {
    const whole = new Uint8Array(await res.arrayBuffer())
    return whole.byteLength > max ? null : whole
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/**
 * Fetch a photo the caller already passed the host allow-list for. Redirects
 * are refused (an allowed host must not be able to bounce us to a disallowed
 * one), the size is capped, and the type comes from the bytes.
 */
async function fetchPhoto(url: string): Promise<Photo | { error: string }> {
  const tooBig = 'That photo is over 8 MB — use a smaller one.'
  try {
    const res = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    })
    if (!res.ok) return { error: `Could not load that photo (${res.status}).` }
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES) return { error: tooBig }
    const bytes = await readCapped(res, MAX_PHOTO_BYTES)
    if (!bytes) return { error: tooBig }
    const mediaType = sniffImageType(bytes)
    if (!mediaType) return { error: 'That file is not a JPEG, PNG, WebP or GIF image.' }
    return { bytes, mediaType }
  } catch {
    return { error: 'Could not load that photo.' }
  }
}

/** The draft's own columns, read as the caller (RLS: their rows). Best effort — prompt help works without it. */
async function loadPiece(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: 'review' | 'guide',
  id: string,
): Promise<PieceRow | null> {
  try {
    const query = type === 'review'
      ? supabase.from('reviews').select('title, category, excerpt, content').eq('id', id).maybeSingle()
      : supabase.from('guides').select('title, category, excerpt, content').eq('id', id).maybeSingle()
    const { data } = await query
    return data ?? null
  } catch {
    return null
  }
}

// POST /api/images/prompt — rewrite, vary, freshly propose or describe-from-a-photo
// an image prompt. Text-only and cheap; the paid generation stays behind its own button.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success } = await checkRateLimit(`claude-aux:${user.id}`, 'claude-aux')
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded — prompt help allows 30 requests per hour.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = AssistInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const input = parsed.data

  // Describe reads a photo, so the URL is checked before anything is fetched:
  // only our own storage and the CDNs next/image already trusts.
  let photo: Photo | null = null
  if (input.mode === 'describe') {
    const url = input.image_url ?? ''
    if (!url || !isRenderableImageUrl(url)) {
      return NextResponse.json({ error: 'Prompt help can only read photos from the media library.' }, { status: 422 })
    }
    const fetched = await fetchPhoto(url)
    if ('error' in fetched) return NextResponse.json({ error: fetched.error }, { status: 422 })
    photo = fetched
  }

  const piece = input.source_type && input.source_id
    ? await loadPiece(supabase, input.source_type, input.source_id)
    : null
  const ctx = resolveAssistContext(input, piece)

  const system = buildAssistSystem({ target: input.target, people: input.people, allowText: input.allow_text, look: input.look })
  const userText = buildAssistUser(input, ctx)
  const messages: ModelMessage[] | undefined = photo
    ? [{
        role: 'user',
        content: [
          { type: 'image', image: photo.bytes, mediaType: photo.mediaType },
          { type: 'text', text: userText },
        ],
      }]
    : undefined

  try {
    const { object, meta } = await aiGenerateObjectWithMeta<AssistResult>({
      bucket: 'utility',
      model: MODELS.claudeSonnet,
      tag: 'image-prompt',
      schema: AssistOutput,
      system,
      ...(messages ? { messages } : { prompt: userText }),
      // Short structured answer against a fixed rule set: thinking buys nothing
      // (see the effort note in lib/ai/client.ts).
      effort: 'low',
      // Ideation (a fresh idea, three different takes) is re-clicked for new
      // results, so it runs hot; a rewrite or a description stays near its source.
      temperature: input.mode === 'variations' || input.mode === 'fresh' ? 0.9 : 0.7,
      maxOutputTokens: 3000,
      maxRetries: 2,
    })

    const prompts = object.prompts.slice(0, promptCount(input.mode)).map((p) => ({
      prompt:  p.prompt.trim(),
      shot:    p.shot,
      aspect:  settleAspect(input.target, p.aspect, input.aspect),
      altText: p.altText.trim(),
      caption: p.caption.trim(),
    }))

    // No `generations` row: aux routes do not log, and nothing here is a stage of a piece.
    return NextResponse.json({ prompts, model: meta.model, latencyMs: meta.latencyMs })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('image-prompt error:', c.kind, '-', c.detail)
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
