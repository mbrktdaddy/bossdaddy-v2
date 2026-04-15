import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({ email: z.string().email() })

export async function POST(request: NextRequest) {
  const body = await request.formData().catch(() => null)
  const email = body?.get('email')?.toString() ?? ''

  const parsed = Schema.safeParse({ email })
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL('/?newsletter=error', request.url)
    )
  }

  const supabase = createAdminClient()
  await supabase
    .from('newsletter_subscribers')
    .upsert({ email: parsed.data.email }, { onConflict: 'email' })

  return NextResponse.redirect(
    new URL('/?newsletter=success', request.url)
  )
}
