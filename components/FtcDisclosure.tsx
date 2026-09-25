import { FTC_DISCLOSURE_HTML } from '@/lib/affiliate'

// FTC affiliate disclosure — legally required, clear and conspicuous, ABOVE the
// first affiliate link. Render on every public page that can emit a `/go/` link
// or an `affiliate_url` CTA; the footer "Disclosure" link alone doesn't count.
// Deliberately a quiet one-liner (Wirecutter-style), not a boxed banner — but
// keep it above the first link and legible; don't shrink or hide it further.
export default function FtcDisclosure({ className = 'mb-6' }: { className?: string }) {
  return (
    <div
      className={`${className} text-xs leading-relaxed text-prose-muted italic [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-prose`}
      dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
    />
  )
}
