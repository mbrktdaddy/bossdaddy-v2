// Server-only. Never import from client components.
import * as React from 'react'
import { getResend, FROM_EMAIL } from '@/lib/resend'
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
}) {
  const { to, orderNumber, items, subtotalCents, taxCents, totalCents, shippingAddress } = args
  const resend = getResend()

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Order confirmed — ${orderNumber}`,
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
    if (error) console.error('order-emails: resend error', orderNumber, error)
  } catch (err) {
    console.error('order-emails: send threw', orderNumber, err)
  }
}
