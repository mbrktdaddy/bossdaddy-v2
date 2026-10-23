// Grouping for the dashboard's prompt-performance card (content pipeline plan
// Phase 4). Pure, so the rollup is testable without the view.

// Every column is nullable: Postgres types a UNION view's columns that way.
export interface PerformanceRow {
  content_type: string | null
  prompt_version: string | null
  generation_method: string | null
  view_count: number | null
  scroll_75_count: number | null
}

export interface PerformanceSummary {
  /** A real version string, or 'untracked' for pieces that predate provenance (mig 164). */
  promptVersion: string
  /** ai-drafted | ai-assisted | human | 'unknown' */
  generationMethod: string
  pieces: number
  views: number
  /** scroll_75 / views, capped at 1 (a scroll ping can outrun its view ping). */
  finishRate: number
}

export const UNTRACKED_VERSION = 'untracked'

/**
 * One row per (prompt version, method) with at least one view, newest version
 * first (versions are `YYYY-MM-DD.n`, so a string sort is a date sort);
 * `untracked` last. A piece with zero views still counts toward `pieces`.
 */
export function summarizePromptPerformance(rows: PerformanceRow[]): PerformanceSummary[] {
  const groups = new Map<string, { summary: PerformanceSummary; scroll75: number }>()
  for (const r of rows) {
    const promptVersion = r.prompt_version?.trim() || UNTRACKED_VERSION
    const generationMethod = r.generation_method?.trim() || 'unknown'
    const key = `${promptVersion}\u0000${generationMethod}`
    const g = groups.get(key) ?? { summary: { promptVersion, generationMethod, pieces: 0, views: 0, finishRate: 0 }, scroll75: 0 }
    g.summary.pieces += 1
    g.summary.views += r.view_count ?? 0
    g.scroll75 += r.scroll_75_count ?? 0
    groups.set(key, g)
  }
  const out: PerformanceSummary[] = []
  for (const { summary, scroll75 } of groups.values()) {
    if (summary.views === 0) continue
    out.push({ ...summary, finishRate: Math.min(1, scroll75 / summary.views) })
  }
  return out.sort((a, b) => {
    if (a.promptVersion === UNTRACKED_VERSION) return 1
    if (b.promptVersion === UNTRACKED_VERSION) return -1
    return b.promptVersion.localeCompare(a.promptVersion) || a.generationMethod.localeCompare(b.generationMethod)
  })
}
