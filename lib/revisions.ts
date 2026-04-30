import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

type ContentType = 'guide' | 'review'

const MAX_REVISIONS_PER_ITEM = 50

/**
 * Capture a revision snapshot. Called after a successful update.
 * Keeps only the last MAX_REVISIONS_PER_ITEM revisions per item; prunes oldest.
 */
export async function snapshotRevision(
  contentType: ContentType,
  contentId: string,
  snapshot: Record<string, unknown>,
  createdBy: string | null,
): Promise<void> {
  const admin = createAdminClient()

  // Determine next version number
  const { data: latest } = await admin
    .from('content_revisions')
    .select('version_number')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (latest?.version_number ?? 0) + 1

  // Insert new revision
  const { error: insertError } = await admin
    .from('content_revisions')
    .insert({
      content_type:   contentType,
      content_id:     contentId,
      version_number: nextVersion,
      snapshot:       snapshot as unknown as Json,
      created_by:     createdBy,
    })

  if (insertError) {
    console.error('Failed to snapshot revision:', insertError)
    return
  }

  // Prune if over cap
  if (nextVersion > MAX_REVISIONS_PER_ITEM) {
    const { data: keepers } = await admin
      .from('content_revisions')
      .select('id')
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .order('version_number', { ascending: false })
      .limit(MAX_REVISIONS_PER_ITEM)

    const keepIds = (keepers ?? []).map((r) => r.id)
    if (keepIds.length) {
      await admin
        .from('content_revisions')
        .delete()
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .not('id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`)
    }
  }
}
