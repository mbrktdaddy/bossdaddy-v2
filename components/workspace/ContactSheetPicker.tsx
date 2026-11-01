'use client'

import { buttonVariants } from '@/components/ui/Button'

// The contact sheet (Sprint B, 2026-10-31): three cheap Draft-tier renders of
// one prompt, side by side, so the author judges the COMPOSITION before paying
// for the Publication render. Pick one → Finalize sends that draft back as the
// reference image for the OpenAI edit endpoint, which holds the framing and
// raises the finish. Presentational only — the panels own the fetches.
//
// The thumbnails show the band that survives the server's centre crop
// (`object-cover` on the target aspect), so what is picked is what lands.
// Picked state changes border colour only — never size, radius or spacing.

export type SheetDraft = { url: string; filename: string }
export type SheetAspect = '16:10' | '3:2' | '1:1' | '4:5'

const ASPECT_CLASS: Record<SheetAspect, string> = {
  '16:10': 'aspect-[16/10]',
  '3:2':   'aspect-[3/2]',
  '1:1':   'aspect-square',
  '4:5':   'aspect-[4/5]',
}

interface Props {
  drafts: SheetDraft[]
  aspect: SheetAspect
  /** The picked draft's filename, or null. */
  picked: string | null
  onPick: (filename: string) => void
  /** Render the pick at the Publication tier from its composition. */
  onFinalize: () => void
  /** Throw this sheet away and render three new drafts. */
  onReroll: () => void
  /** Close the sheet without rendering anything. */
  onDiscard: () => void
  busy: 'finalizing' | 'rerolling' | null
  disabled?: boolean
  /** The tier the final renders at — IMAGE_TIERS.publication.label. */
  finalLabel: string
}

export function ContactSheetPicker({
  drafts, aspect, picked, onPick, onFinalize, onReroll, onDiscard, busy, disabled = false, finalLabel,
}: Props) {
  const locked = disabled || busy !== null
  const frame = ASPECT_CLASS[aspect]

  return (
    <div className="space-y-2" aria-busy={busy !== null}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-prose-faint">
          Contact sheet · {drafts.length} drafts
        </span>
        <span className="text-[11px] text-prose-faint">Tap one to pick it</span>
      </div>

      <div role="radiogroup" aria-label="Pick a draft" className="grid grid-cols-3 gap-2">
        {drafts.map((d, i) => {
          const isPicked = picked === d.filename
          return (
            <button
              key={d.filename}
              type="button"
              role="radio"
              aria-checked={isPicked}
              aria-label={`Draft ${i + 1}`}
              disabled={locked}
              onClick={() => onPick(d.filename)}
              className={`relative block w-full overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 ${
                isPicked ? 'border-accent' : 'border-soft hover:border-strong'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.url} alt="" className={`w-full ${frame} object-cover bg-surface-raised`} />
              <span
                aria-hidden
                className={`absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white ${
                  isPicked ? 'bg-accent' : 'bg-chrome'
                }`}
              >
                {isPicked ? 'Pick' : i + 1}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onFinalize}
          disabled={locked || !picked}
          className={buttonVariants({ className: 'grow' })}
          title={picked ? `Render the pick at ${finalLabel} from this composition` : 'Pick a draft first'}
        >
          {busy === 'finalizing' ? 'Finalizing…' : `Finalize · ${finalLabel}`}
        </button>
        <button type="button" onClick={onReroll} disabled={locked} className={buttonVariants({ variant: 'outline' })}>
          {busy === 'rerolling' ? 'Rendering…' : 'Reroll'}
        </button>
        <button type="button" onClick={onDiscard} disabled={locked} className={buttonVariants({ variant: 'ghost' })}>
          Discard
        </button>
      </div>

      <p className="text-[11px] text-prose-faint leading-snug">
        Drafts are the Draft tier at low quality — judge the framing, not the finish. Finalize keeps the picked composition and renders it at {finalLabel}; only the final is checked by vision QA.
      </p>
    </div>
  )
}
