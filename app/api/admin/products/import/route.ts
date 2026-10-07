import { NextResponse, after, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { checkRateLimit } from '@/lib/rate-limit'
import { classifyClaudeError } from '@/lib/ai/errors'
import { generateUniqueSlug, slugifyTitle } from '@/lib/slug'
import { extractAsin } from '@/lib/amazon-tag'
import { hasLookupInput, importProductFromUrl, lookupProductFacts, type LookupInput } from '@/lib/products/import'
import { productSlugSource } from '@/lib/products/identifiers'
import { createJob, getJob, markDone, markError, markRunning } from '@/lib/aiJobs'

// The web lookup runs in after() as an ai_jobs row the form polls (same
// pattern as specs-grade): measured runs took 20-50s+, more than a request can
// reliably hold, and a phone that sleeps mid-request would lose the result.
// The function instance stays alive for the after() work up to maxDuration;
// the lookup's own timeout (150s) sits inside it.
export const maxDuration = 300

const Input = z.object({
  url:  z.url({ protocol: /^https?$/ }).max(2048).optional(),
  // 'page' reads the page (free). 'lookup' runs the opt-in web lookup (AI).
  mode: z.enum(['page', 'lookup']).optional().default('page'),
  // Lookup only: what the admin already typed, used as ground truth.
  hints: z.object({
    name:        z.string().max(160).optional(),
    brand:       z.string().max(120).optional(),
    modelNumber: z.string().max(60).optional(),
    gtin:        z.string().max(20).optional(),
  }).optional(),
})

// POST /api/admin/products/import — paste-a-link product import (admin only).
// 'page' returns suggested form values; 'lookup' returns { jobId } (202) for
// GET to poll. Writes nothing to products. See lib/products/import.ts.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const parsed = Input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paste a full product link (https://…).' }, { status: 400 })
  }
  const { url, mode, hints } = parsed.data

  if (mode === 'lookup') {
    const input: LookupInput = { url: url ?? null, asin: url ? extractAsin(url) : null, ...hints }
    if (!hasLookupInput(input)) {
      return NextResponse.json({ error: 'Paste a link or type a model number, GTIN or name to look up.' }, { status: 400 })
    }
    const { success } = await checkRateLimit(`product-import:${gate.user.id}`, 'claude-aux')
    if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })

    let jobId: string
    try {
      jobId = await createJob(gate.user.id, 'product_lookup', { ...input })
    } catch (err) {
      console.error('product-import lookup start error:', err)
      return NextResponse.json({ error: "Couldn't start the lookup. Try again." }, { status: 500 })
    }
    after(async () => {
      const startedAt = Date.now()
      try {
        await markRunning(jobId)
        const lookup = await lookupProductFacts(input)
        const slug = lookup.name
          ? await uniqueSlug(productSlugSource({ name: lookup.name, brand: lookup.brand, modelNumber: lookup.modelNumber }))
          : null
        // Timing on success too, so the time budget is set from data.
        console.info(`product-import lookup ${lookup.found ? 'found' : 'not found'} after ${Date.now() - startedAt}ms`)
        await markDone(jobId, { lookup, slug })
      } catch (err) {
        const c = classifyClaudeError(err)
        console.error(`product-import lookup error after ${Date.now() - startedAt}ms:`, c.kind, '-', c.detail)
        await markError(jobId, c.userMessage)
      }
    })
    return NextResponse.json({ jobId }, { status: 202 })
  }

  if (!url) return NextResponse.json({ error: 'Paste a full product link (https://…).' }, { status: 400 })
  try {
    const result = await importProductFromUrl(url, process.env.AMAZON_ASSOCIATE_TAG ?? '')
    return NextResponse.json({ import: result, slug: result.name ? await uniqueSlug(productSlugSource({ name: result.name, brand: result.brand, modelNumber: result.modelNumber })) : null })
  } catch (err) {
    console.error('product-import error:', err)
    return NextResponse.json({ error: "Couldn't import that link." }, { status: 500 })
  }
}

// GET /api/admin/products/import?jobId=… — poll a web lookup job.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
  const job = await getJob(jobId, gate.user.id)
  if (!job || job.kind !== 'product_lookup') return NextResponse.json({ error: 'Lookup not found' }, { status: 404 })
  return NextResponse.json({ status: job.status, result: job.result, error: job.error })
}

/** A slug suggestion that doesn't collide with an existing product: brand-model when known, else the name. */
async function uniqueSlug(source: string): Promise<string | null> {
  if (!slugifyTitle(source)) return null
  return generateUniqueSlug(createAdminClient(), 'products', source)
}
