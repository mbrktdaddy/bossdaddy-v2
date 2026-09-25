// The one card/panel shell: surface fill + hairline border + xl radius.
// Elevation comes from border + tone, never shadow (dark canvas — brand-guide §2).
// There's no class-merging here, so never pass a bg-*, border-colour or
// rounded-* class through `className` — pick a `tone` instead. Padding,
// layout and hover-border classes are fine.
//   surface — default card/panel
//   raised  — a card sitting on a card
//   sunken  — a recessed well inside a panel (form sub-sections, previews)
//   faint   — half-strength surface for quiet asides

const TONE = {
  surface: 'bg-surface',
  raised:  'bg-surface-raised',
  sunken:  'bg-surface-sunken',
  faint:   'bg-surface/50',
} as const

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside' | 'li'
  tone?: keyof typeof TONE
}

export function Card({ as: Tag = 'div', tone = 'surface', className = '', children, ...props }: CardProps) {
  return (
    <Tag className={`${TONE[tone]} border border-soft rounded-xl ${className}`} {...props}>
      {children}
    </Tag>
  )
}
