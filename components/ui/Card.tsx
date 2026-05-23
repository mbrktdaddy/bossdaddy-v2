interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
}

export function Card({ as: Tag = 'div', className = '', children, ...props }: CardProps) {
  return (
    <Tag className={`bg-surface rounded-xl border border-soft ${className}`} {...props}>
      {children}
    </Tag>
  )
}
