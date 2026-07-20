// Server-only. Never import from client components.
import Stripe from 'stripe'

// Pin the API version so runtime response shapes match the SDK's generated
// types. stripe-node v22 targets '2026-06-24.dahlia'; without an explicit pin
// the account default is used and can drift from the types. Same `dahlia`
// major as before, so no behavioral break (shipping_details stays under
// session.collected_information — see the webhook handler).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
})
