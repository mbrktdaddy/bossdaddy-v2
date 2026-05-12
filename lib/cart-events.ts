// Cross-component cart sync. CartIcon (in the nav) listens for this event so
// its badge re-fetches after any mutation. Every cart write — add, update qty,
// remove, post-purchase clear — must dispatch this. Centralizing the event
// name prevents typos and makes it easy to grep for all mutation sites.

export const CART_UPDATED_EVENT = 'cart-updated'

export function dispatchCartUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT))
  }
}
