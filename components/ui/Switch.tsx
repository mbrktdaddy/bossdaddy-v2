// The on/off control (continuity plan P18) — settings toggles, opt-ins.
//
// THE ONE SANCTIONED PILL. Hard Goods squares everything else (chips, buttons,
// badges), but a switch is a physical metaphor — a thumb that slides in a
// track — and a square track reads as a checkbox that's lost its tick. So the
// TRACK is rounded-full; it carries no text and no padding, which is how the
// hard-goods guard tells it from a pill chip.
//
// 44px hit area around a 44×24 track (the visible control stays small, the
// thumb is the target). Accent when on; the state changes colour and the
// thumb's position, never the control's size. role="switch" + aria-checked.
// Name it with a visible <label htmlFor={id}> (a button is labelable) or `label`.

interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  id?: string
  /** aria-label, when there's no visible <label htmlFor>. */
  label?: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onChange, id, label, disabled = false, className = '' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group inline-flex items-center justify-center w-14 h-11 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none ${className}`}
    >
      <span
        aria-hidden
        className={`relative inline-block w-11 h-6 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface ${
          checked ? 'bg-accent' : 'bg-strong'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </span>
    </button>
  )
}
