'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'

const UpdateSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be 20 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')
    .optional(),
  display_name: z.string().min(1).max(60).optional().nullable(),
  tagline:      z.string().max(120).optional().nullable(),
  bio:          z.string().max(800).optional().nullable(),
  avatar_url:   z.string().url().max(2048).optional().nullable(),
})

export type UpdateProfileResult = { ok: true } | { ok: false; error: string }

export async function updateProfile(input: z.input<typeof UpdateSchema>): Promise<UpdateProfileResult> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('profiles').update(updates as any).eq('id', user.id)
  if (error) {
    const msg = error.message.includes('unique')
      ? 'That username is already taken.'
      : 'Failed to update profile.'
    return { ok: false, error: msg }
  }

  revalidatePath('/dashboard/profile')
  return { ok: true }
}
