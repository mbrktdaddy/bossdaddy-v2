// The one card/panel shell: surface fill + border + the global radius.
// Elevation comes from border + tone, never shadow (brand-guide §2/§4).
// There's no class-merging here, so never pass a bg-*, border-colour or
// rounded-* class through `className` — pick a `tone` instead. Padding,
// layout and hover-border classes are fine.
//   chrome  — the Hard Goods utility BOX: 2px chrome-black edge (2026-10-14).
//             Public utility modules — verdict, testing log, specs, comments
//             form, product CTA, tool tiles. The box that holds its own on white.
//   surface — hairline card/panel: forms, menus, dashboard panels, admin lists
//   raised  — a card sitting on a card
//   sunken  — a recessed well inside a panel (form sub-sections, previews)
//   faint   — half-strength surface for quiet asides

const TONE = {
  chrome:  'bg-surface border-2 border-chrome',
  surface: 'bg-surface border border-soft',
  raised:  'bg-surface-raised border border-soft',
  sunken:  'bg-surface-sunken border border-soft',
  faint:   'bg-surface/50 border border-soft',
} as const

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside' | 'li'
  tone?: keyof typeof TONE
}

export function Card({ as: Tag = 'div', tone = 'surface', className = '', children, ...props }: CardProps) {
  return (
    <Tag className={`${TONE[tone]} rounded-xl ${className}`} {...props}>
      {children}
    </Tag>
  )
}
