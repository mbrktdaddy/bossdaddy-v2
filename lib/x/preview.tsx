import type { DroppedTag } from './serialize'

// ─────────────────────────────────────────────────────────────────────────────
// X Article preview
//
// Presentational only — takes the already-serialized X-safe HTML + the
// `dropped[]` report from `serializeForX` and frames it like an X Article, with
// a warning banner for anything X would strip. Deliberately imports only the
// TYPE from `serialize.ts` (erased at build) so the heavy `sanitize-html`
// dependency never reaches the client bundle. No hooks / server-only APIs, so
// it renders in both Server and Client trees.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** X-safe HTML from `serializeForX().html`. */
  html: string
  /** The `serializeForX().dropped` report. */
  dropped: DroppedTag[]
  title?: string
  coverImageUrl?: string | null
  className?: string
}

export function XArticlePreview({ html, dropped, title, coverImageUrl, className = '' }: Props) {
  return (
    <div className={`bg-surface-sunken border border-soft rounded-xl overflow-hidden text-sm ${className}`}>
      {/* Header strip — mirrors the public review preview */}
      <div className="bg-surface border-b border-soft px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-prose-faint font-medium">X Article preview</span>
        <span className="text-xs text-accent-text-soft/70 font-medium">x.com</span>
      </div>

      {/* What X will silently strip */}
      {dropped.length > 0 && (
        <div className="border-b border-soft bg-surface-raised px-4 py-3">
          <p className="text-xs font-bold text-accent uppercase tracking-widest mb-2">
            Stripped on X ({dropped.length})
          </p>
          <ul className="space-y-1">
            {dropped.map((d) => (
              <li key={d.tag} className="flex items-start gap-2 text-xs text-prose-muted leading-relaxed">
                <span className="shrink-0 font-mono text-[11px] bg-surface-sunken border border-soft rounded px-1.5 py-0.5 text-prose">
                  {`<${d.tag}>`}
                </span>
                <span>
                  <span className="text-prose-faint">×{d.count}</span>
                  {d.action === 'converted' && d.to && (
                    <span className="text-prose-faint"> → {`<${d.to}>`}</span>
                  )}
                  {' — '}{d.note}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 py-6 space-y-5 overflow-y-auto max-h-[calc(100vh-180px)]">
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt={title ?? 'Cover image'} className="w-full h-44 object-cover rounded-xl" />
        )}

        {title !== undefined && (
          <h1 className="text-xl font-black leading-tight text-prose">
            {title || <span className="text-prose-faint italic">Untitled article</span>}
          </h1>
        )}

        {html ? (
          <div
            className="prose prose-sm prose-zinc prose-orange max-w-none
              prose-headings:font-black prose-headings:font-sans prose-headings:tracking-tight
              prose-h1:text-lg prose-h1:mt-6 prose-h1:mb-2
              prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2
              prose-p:text-prose-muted prose-p:leading-relaxed prose-p:text-xs
              prose-a:text-accent-text-soft prose-a:no-underline
              prose-strong:text-prose prose-li:text-xs prose-li:text-prose-muted
              prose-blockquote:border-l-soft prose-blockquote:text-prose-muted"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-prose-faint italic text-xs">Nothing to preview yet.</p>
        )}
      </div>
    </div>
  )
}
