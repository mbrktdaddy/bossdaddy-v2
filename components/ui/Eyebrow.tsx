// The standalone block eyebrow — the small orange caps label over a sub-block
// ("The Lineup", "Quick Take", "Specs Grade"). Name the ROLE, never repeat the
// title it sits over (Eyebrow Doctrine). PageHeader / EditorialHeader render
// their own eyebrow as part of the heading lockup — use those for H1/H2s.
// Spacing and layout classes go in `className`; don't override size/colour/weight.

interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'div' | 'h2' | 'h3'
}

export function Eyebrow({ as: Tag = 'p', className = '', children, ...props }: EyebrowProps) {
  return (
    <Tag className={`text-xs text-eyebrow uppercase tracking-widest font-semibold ${className}`} {...props}>
      {children}
    </Tag>
  )
}
