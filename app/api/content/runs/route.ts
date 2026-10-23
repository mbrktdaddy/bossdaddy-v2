import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { BriefInput, normalizeBrief } from '@/lib/content/pipeline/briefs'
import { createRun, findResumableRun } from '@/lib/content/pipeline/run'
import { requireAuthor } from '@/lib/content/pipeline/route-helpers'
import { buildBossDaddySystemMessagesWithInfo } from '@/lib/voiceProfile'

// Staged content pipeline — docs/content-pipeline-plan.md §4.
//   POST /api/content/runs            { brief } → { run }   (status 'outline')
//   GET  /api/content/runs?type=review → { run | null }     (latest unfinished run to resume)

const CreateInput = z.object({ brief: BriefInput })

export async function POST(request: NextRequest) {
  const auth = await requireAuthor()
  if ('error' in auth) return auth.error
  const { supabase, userId } = auth

  const body = await request.json().catch(() => null)
  const parsed = CreateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid brief', details: parsed.error.flatten() }, { status: 400 })
  }

  const brief = normalizeBrief(parsed.data.brief)

  // The exact model tested (mig 159), from the catalog: readers search by it.
  if (brief.contentType === 'review' && brief.productSlug && !brief.modelNumber) {
    const { data } = await supabase.from('products').select('model_number').eq('slug', brief.productSlug).maybeSingle()
    if (data?.model_number) brief.modelNumber = data.model_number
  }

  try {
    const run = await createRun(supabase, userId, brief)
    // What the voice system will find for this author — the wizard shows the
    // "no voice profile" notice at the plan step if it's missing.
    const { info: voice } = await buildBossDaddySystemMessagesWithInfo(supabase, userId)
    return NextResponse.json({ run, voice }, { status: 201 })
  } catch (err) {
    console.error('createRun error:', err)
    return NextResponse.json({ error: 'Could not start a draft run.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthor()
  if ('error' in auth) return auth.error
  const type = request.nextUrl.searchParams.get('type')
  if (type !== 'review' && type !== 'guide') {
    return NextResponse.json({ error: 'type must be review or guide' }, { status: 400 })
  }
  const run = await findResumableRun(auth.supabase, auth.userId, type)
  return NextResponse.json({ run })
}
