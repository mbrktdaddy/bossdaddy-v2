// Server-only. Never import from client components.
import { render } from '@react-email/render'
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

  const html = await render(
    OrderConfirmationEmail({ orderNumber, email: to, items, subtotalCents, taxCents, totalCents, shippingAddress })
  )

  const resend = getResend()
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Order confirmed — ${orderNumber}`,
    html,
  })
}
