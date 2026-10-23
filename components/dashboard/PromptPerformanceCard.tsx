import { createAdminClient } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { summarizePromptPerformance } from '@/lib/content/performance'

// Async Server Component — scroll-75 rate by prompt version, from the
// `content_performance` view (mig 168). This is the outcome signal the content
// eval is judged against: did a prompt change make more readers finish? Reads
// through the service role (the view is revoked from anon/authenticated).
// Renders nothing until something has been read. Dashboard only — view counts
// never appear on public pages.

export async function PromptPerformanceCard() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_performance')
    .select('content_type, prompt_version, generation_method, view_count, scroll_75_count')

  if (error) { console.error('PromptPerformanceCard: view fetch failed', error); return null }
  const rows = summarizePromptPerformance(data ?? [])
  if (rows.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-soft">
        <p className="text-sm font-semibold text-prose">Readers finishing, by prompt version</p>
        <p className="text-xs text-prose-faint mt-0.5">
          Share of views that reached 75% of the page. Compare versions, not single pieces — small view counts swing hard.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-prose-faint uppercase tracking-widest">
            <th className="text-left font-medium px-5 py-2">Version</th>
            <th className="text-left font-medium px-2 py-2">Method</th>
            <th className="text-right font-medium px-2 py-2">Pieces</th>
            <th className="text-right font-medium px-2 py-2">Views</th>
            <th className="text-right font-medium px-5 py-2">Finished</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-soft">
          {rows.map((r) => (
            <tr key={`${r.promptVersion}:${r.generationMethod}`}>
              <td className="px-5 py-2.5 font-mono text-xs text-prose">{r.promptVersion}</td>
              <td className="px-2 py-2.5 text-xs text-prose-muted">{r.generationMethod}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-prose-muted">{r.pieces}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-prose-muted">{r.views.toLocaleString('en-US')}</td>
              <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-prose">
                {r.views >= 20 ? `${Math.round(r.finishRate * 100)}%` : <span className="text-prose-faint font-normal">n/a</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
