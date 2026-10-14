'use client'
import { RouteError, type RouteErrorProps } from '@/components/ui/RouteError'

export default function Error(props: RouteErrorProps) {
  return <RouteError {...props} body="This profile page hit an error. Try refreshing or head back." back={{ href: '/explore', label: 'Explore' }} />
}
