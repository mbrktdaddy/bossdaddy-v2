import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to share.' }, { status: 401 })

  const { error } = await supabase
    .from('comment_shares')
    .insert({ comment_id: id })

  if (error) return NextResponse.json({ error: 'Failed to record share' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
