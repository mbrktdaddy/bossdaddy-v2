import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')?.trim()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/bench?msg=invalid-token`)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('wishlist_subscriptions')
    .delete()
    .eq('unsubscribe_token', token)

  if (error) {
    return NextResponse.redirect(`${siteUrl}/bench?msg=unsubscribe-error`)
  }

  return NextResponse.redirect(`${siteUrl}/bench?msg=unsubscribed`)
}
