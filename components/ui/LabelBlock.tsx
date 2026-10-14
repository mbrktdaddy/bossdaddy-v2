// The section label block — Hard Goods, 2026-10-14 (brand-guide §5/§6/§10).
// A small SOLID stamp naming a section's ROLE ("Featured review", "Tools",
// "About the Boss"). It replaces the quiet grey eyebrow on section headers and
// is where the black/orange "moments" on the white page start. The Eyebrow
// Doctrine still applies: name the role, never repeat the title beneath it.
//   ink    — black block, white caps  (default; light surfaces)
//   accent — orange block, white caps (inside dark bands — About, bench head)
// Spacing/layout classes go in `className`; don't override size/colour/weight.

interface LabelBlockProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'span' | 'p' | 'div'
  tone?: 'ink' | 'accent'
}

const TONE = {
  ink:    'bg-chrome text-white',
  accent: 'bg-accent text-white',
} as const

export function LabelBlock({ as: Tag = 'span', tone = 'ink', className = '', children, ...props }: LabelBlockProps) {
  return (
    <Tag
      className={`inline-block font-display font-black text-[11px] uppercase tracking-[0.16em] leading-tight px-2.5 py-1.5 ${TONE[tone]} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}
