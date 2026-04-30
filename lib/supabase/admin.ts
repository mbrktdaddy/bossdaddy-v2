import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Service-role client — server-only. Never import in client components.
// Bypasses RLS — use only for trusted server operations (moderation, webhooks).
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
