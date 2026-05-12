// Server-only. Never import from client components.
import * as React from 'react'
import { sendEmail, type EmailResult } from '@/lib/email'
import { OrderConfirmationEmail } from '@/emails/OrderConfirmationEmail'

interface OrderItem {
  name: string
  qty: number
  unit_price_cents: number
  image_snapshot_url: string | null
}

interface ShippingAddress {
  name?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

export async function sendOrderConfirmationEmail(args: {
  to: string
  orderNumber: string
  items: OrderItem[]
  subtotalCents: number
  taxCents: number
  totalCents: number
  shippingAddress: ShippingAddress | null
}): Promise<EmailResult> {
  const { to, orderNumber, items, subtotalCents, taxCents, totalCents, shippingAddress } = args
  return sendEmail({
    to,
    subject: `Order confirmed — ${orderNumber}`,
    tag: 'order_confirmation',
    react: React.createElement(OrderConfirmationEmail, {
      orderNumber,
      email: to,
      items,
      subtotalCents,
      taxCents,
      totalCents,
      shippingAddress,
    }),
  })
}
