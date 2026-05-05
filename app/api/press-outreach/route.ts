import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/resend'
import { requireAdmin } from '@/lib/auth-cache'
import { z } from 'zod'

const Schema = z.object({
  product_id:     z.string().uuid().nullable().optional(),
  product_name:   z.string().min(1),
  brand_name:     z.string().min(1),
  contact_name:   z.string().optional(),
  contact_email:  z.string().email().optional().or(z.literal('')),
  contact_method: z.enum(['email', 'web_form', 'amazon', 'phone']),
  contact_url:    z.string().optional(),
  subject:        z.string().min(1),
  body:           z.string().min(1),
})

export async function GET() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('press_outreach')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  await requireAdmin()

  const raw = await request.json()
  const parsed = Schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  if (d.contact_method === 'email') {
    if (!d.contact_email) {
      return NextResponse.json({ error: 'Contact email is required for email outreach.' }, { status: 400 })
    }
    const resend = getResend()
    const { error: emailError } = await resend.emails.send({
      from: 'Michael Brackett | Boss Daddy <boss@bossdaddylife.com>',
      to: d.contact_email,
      subject: d.subject,
      text: d.body,
    })
    if (emailError) {
      return NextResponse.json({ error: 'Failed to send: ' + emailError.message }, { status: 500 })
    }
  }

  const admin = createAdminClient()
  const { data: record, error: dbError } = await admin
    .from('press_outreach')
    .insert({
      product_id:    d.product_id ?? null,
      product_name:  d.product_name,
      brand_name:    d.brand_name,
      contact_name:  d.contact_name || null,
      contact_email: d.contact_email || null,
      contact_method: d.contact_method,
      contact_url:   d.contact_url || null,
      subject:       d.subject,
      body:          d.body,
      status:        d.contact_method === 'email' ? 'sent' : 'draft',
      sent_at:       d.contact_method === 'email' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(record, { status: 201 })
}
