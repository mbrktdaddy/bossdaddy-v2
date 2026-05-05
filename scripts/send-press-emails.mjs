/**
 * One-shot press outreach script — sends product image request emails to 3 brands
 * via Resend from boss@bossdaddylife.com.
 *
 * Usage:
 *   $env:RESEND_API_KEY="re_xxxx"; node scripts/send-press-emails.mjs
 *   $env:RESEND_API_KEY="re_xxxx"; node scripts/send-press-emails.mjs --dry-run
 */

import { Resend } from 'resend'

const DRY_RUN = process.argv.includes('--dry-run')
const FROM = 'Michael Brackett | Boss Daddy <boss@bossdaddylife.com>'

const emails = [
  {
    to: 'media@thorne.com',
    subject: 'Media Image Request — Thorne Zinc Picolinate 30mg | BossDaddyLife.com',
    body: `Hi Thorne Media Team,

My name is Michael Brackett, and I'm the founder of BossDaddyLife.com — a product review site built specifically for dads navigating gear, health, and family life. We publish in-depth, first-person reviews with affiliate partnerships.

I recently published a review of Thorne Zinc Picolinate 30mg and gave it a 10/10 — it's one of the few supplements I genuinely recommend to every dad on my list. You can see our reviews here: https://www.bossdaddylife.com/reviews

I'm building out product image galleries for each reviewed product on our site and would love to include official hi-res product photography for the Zinc Picolinate. Could your team share any press or media images cleared for use on affiliate review sites?

Thank you for your time — happy to provide any additional context about the site or our audience.

Michael Brackett
Founder, BossDaddyLife.com
boss@bossdaddylife.com`,
  },
  {
    to: 'customercare@spitjack.com',
    subject: 'Product Image Request — SpitJack Magnum Injector | BossDaddyLife.com',
    body: `Hi SpitJack Team,

My name is Michael Brackett, founder of BossDaddyLife.com — a first-person gear and BBQ review site for dads. I reviewed the SpitJack Magnum Pulse Meat Injector Gun and gave it a 9/10. It's genuinely one of the best BBQ tools I've tested, and I call it out by name when dads ask me what's actually worth buying.

I'm building a product image gallery for each reviewed item on the site and would love to include official hi-res SpitJack product photos alongside the review. Do you have a press or media folder you can share? Even a Dropbox or Google Drive link would be great.

Thanks — keep making great stuff.

Michael Brackett
Founder, BossDaddyLife.com
boss@bossdaddylife.com`,
  },
  {
    to: 'support@fanhaoshop.com',
    subject: 'Product Image Request — FANHAO Metal Hose Nozzle | BossDaddyLife.com',
    body: `Hi FANHAO Team,

My name is Michael Brackett, founder of BossDaddyLife.com — a product review site for dads. I reviewed the FANHAO Heavy Duty Metal Garden Hose Nozzle and rated it 8/10, highlighting the all-metal build quality and spray pattern range.

I'm building out a product image gallery for the review page and would love to include official hi-res product photography. Could you share product images or a media folder that's cleared for use on affiliate review sites?

Thank you — great product and easy to recommend.

Michael Brackett
Founder, BossDaddyLife.com
boss@bossdaddylife.com`,
  },
]

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error('ERROR: RESEND_API_KEY environment variable is not set.')
    console.error('Run: $env:RESEND_API_KEY="re_xxxx"; node scripts/send-press-emails.mjs')
    process.exit(1)
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  console.log(DRY_RUN ? '\n--- DRY RUN (no emails sent) ---\n' : '\n--- SENDING EMAILS ---\n')

  for (const email of emails) {
    console.log(`To:      ${email.to}`)
    console.log(`Subject: ${email.subject}`)

    if (DRY_RUN) {
      console.log(`Body preview:\n${email.body.slice(0, 120)}...\n`)
      console.log('--- [DRY RUN — skipped] ---\n')
      continue
    }

    try {
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: email.to,
        subject: email.subject,
        text: email.body,
      })

      if (error) {
        console.error(`FAILED: ${email.to}`)
        console.error(error)
      } else {
        console.log(`SENT ✓  id: ${data.id}`)
      }
    } catch (err) {
      console.error(`ERROR sending to ${email.to}:`, err.message)
    }

    console.log()

    // 1-second pause between sends to avoid rate limit bursts
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('Done.')
}

main()
