// Run once to register the Printful shipment webhook.
// Usage: node --env-file=.env.local scripts/register-printful-webhook.mjs

const key    = process.env.PRINTFUL_API_KEY
const secret = process.env.PRINTFUL_WEBHOOK_SECRET

if (!key)    { console.error('PRINTFUL_API_KEY not set in .env.local'); process.exit(1) }
if (!secret) { console.error('PRINTFUL_WEBHOOK_SECRET not set in .env.local'); process.exit(1) }

const url = `https://www.bossdaddylife.com/api/webhooks/printful?token=${secret}`

const res = await fetch('https://api.printful.com/webhooks', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url, types: ['package_shipped'] }),
})

const json = await res.json()
console.log(JSON.stringify(json, null, 2))
