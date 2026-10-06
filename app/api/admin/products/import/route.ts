import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { checkRateLimit } from '@/lib/rate-limit'
import { classifyClaudeError } from '@/lib/ai/errors'
import { generateUniqueSlug, slugifyTitle } from '@/lib/slug'
import { extractAsin } from '@/lib/amazon-tag'
import { importProductFromUrl, lookupProductFacts } from '@/lib/products/import'

// The web lookup is a live research call; give it room.
export const maxDuration = 60

const Input = z.object({
  url:  z.url({ protocol: /^https?$/ }).max(2048),
  // 'page' reads the page (free). 'lookup' runs the opt-in web lookup (AI).
  mode: z.enum(['page', 'lookup']).optional().default('page'),
})

// POST /api/admin/products/import — paste-a-link product import (admin only).
// Returns suggested form values; writes nothing. See lib/products/import.ts.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const parsed = Input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paste a full product link (https://…).' }, { status: 400 })
  }
  const { url, mode } = parsed.data

  if (mode === 'lookup') {
    const { success } = await checkRateLimit(`product-import:${gate.user.id}`, 'claude-aux')
    if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })
    try {
      const lookup = await lookupProductFacts({ url, asin: extractAsin(url) })
      return NextResponse.json({ lookup, slug: lookup.name ? await uniqueSlug(lookup.name) : null })
    } catch (err) {
      const c = classifyClaudeError(err)
      console.error('product-import lookup error:', c.kind, '-', c.detail)
      return NextResponse.json({ error: c.userMessage }, { status: c.status })
    }
  }

  try {
    const result = await importProductFromUrl(url, process.env.AMAZON_ASSOCIATE_TAG ?? '')
    return NextResponse.json({ import: result, slug: result.name ? await uniqueSlug(result.name) : null })
  } catch (err) {
    console.error('product-import error:', err)
    return NextResponse.json({ error: "Couldn't import that link." }, { status: 500 })
  }
}

/** A slug suggestion that doesn't collide with an existing product. */
async function uniqueSlug(name: string): Promise<string | null> {
  if (!slugifyTitle(name)) return null
  return generateUniqueSlug(createAdminClient(), 'products', name)
}
