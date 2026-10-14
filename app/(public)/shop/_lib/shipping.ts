// Shipping is free on every store order — /api/checkout adds no shipping
// option, so Stripe charges none. The product page, cart and order page all
// read this one string; if shipping is ever charged, change it HERE and the
// "Free" claims go with it (claims only when true).
export const FREE_SHIPPING_LABEL = 'Free'
export const FREE_SHIPPING_NOTE = 'Free US shipping included'
