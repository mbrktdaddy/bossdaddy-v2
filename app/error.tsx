'use client'
import { RouteError, type RouteErrorProps } from '@/components/ui/RouteError'

export default function Error(props: RouteErrorProps) {
  return <RouteError {...props} body="We hit a snag. Try again or head back home — we're on it." />
}
