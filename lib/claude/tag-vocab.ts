import type { SupabaseClient } from '@supabase/supabase-js'

// DB-driven tag vocabulary for AI draft prompts. The controlled tag set lives
// in the `tags` table (migrations 041/047/121/…). Reading it here — instead of
// hardcoding slug lists in each prompt — means seeding a new tag makes it
// available to the model everywhere with no code change and no drift.
// The draft routes still validate the model's picks against the same table.

export type TagVocab = Record<string, { slug: string; label: string }[]>

export async function fetchTagVocabulary(supabase: SupabaseClient): Promise<TagVocab> {
  const { data } = await supabase
    .from('tags')
    .select('slug, label, tag_group, display_order')
    .order('tag_group')
    .order('display_order')

  const grouped: TagVocab = {}
  for (const t of (data ?? []) as { slug: string; label: string; tag_group: string }[]) {
    ;(grouped[t.tag_group] ??= []).push({ slug: t.slug, label: t.label })
  }
  return grouped
}

// Comma-joined slug list for one tag group (empty string if the group is empty).
export function tagSlugList(vocab: TagVocab, group: string): string {
  return (vocab[group] ?? []).map((t) => t.slug).join(', ')
}
