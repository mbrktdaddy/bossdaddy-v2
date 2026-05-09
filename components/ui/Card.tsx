interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
}

export function Card({ as: Tag = 'div', className = '', children, ...props }: CardProps) {
  return (
    <Tag className={`bg-gray-900 rounded-2xl border border-gray-800 ${className}`} {...props}>
      {children}
    </Tag>
  )
}
