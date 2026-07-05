import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// merch_designs is added in migration 116. Until `npm run db:types` regenerates
// database.types.ts (after the migration is applied), the table isn't in the typed
// schema, so `.from('merch_designs')` would fail typecheck. We deliberately access
// it through a schema-agnostic client here — one contained place — so the rest of
// the app stays fully typed. After db:types runs this still works unchanged; the
// cast simply becomes belt-and-suspenders.
function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

export type MerchDesignStatus = 'draft' | 'approved' | 'published'
export type MerchDesignType = 'saying' | 'logo_lockup'
export type MerchIpFlag = 'none' | 'low' | 'review'

export interface MerchDesignRow {
  id: string
  design_type: MerchDesignType
  title: string
  content: Record<string, unknown>
  theme: string | null
  ip_flag: MerchIpFlag
  ip_note: string | null
  status: MerchDesignStatus
  template_key: string | null
  template_config: Record<string, unknown>
  print_file_url: string | null
  preview_url: string | null
  product_types: string[]
  printful_sync_product_id: number | null
  merch_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface NewMerchDesign {
  design_type?: MerchDesignType
  title: string
  content: Record<string, unknown>
  theme?: string | null
  ip_flag?: MerchIpFlag
  ip_note?: string | null
  status?: MerchDesignStatus
  product_types?: string[]
  notes?: string | null
}

export async function listMerchDesigns(): Promise<MerchDesignRow[]> {
  const { data, error } = await db()
    .from('merch_designs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as MerchDesignRow[]
}

export async function insertMerchDesign(input: NewMerchDesign): Promise<MerchDesignRow> {
  const { data, error } = await db()
    .from('merch_designs')
    .insert({
      design_type: input.design_type ?? 'saying',
      title: input.title,
      content: input.content,
      theme: input.theme ?? null,
      ip_flag: input.ip_flag ?? 'none',
      ip_note: input.ip_note ?? null,
      status: input.status ?? 'draft',
      product_types: input.product_types ?? [],
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as MerchDesignRow
}

export async function updateMerchDesign(
  id: string,
  patch: Partial<Pick<MerchDesignRow, 'title' | 'content' | 'status' | 'ip_flag' | 'ip_note' | 'product_types' | 'notes'>>,
): Promise<MerchDesignRow> {
  const { data, error } = await db()
    .from('merch_designs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as MerchDesignRow
}

export async function deleteMerchDesign(id: string): Promise<void> {
  const { error } = await db().from('merch_designs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
