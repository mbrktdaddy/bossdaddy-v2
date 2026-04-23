// Affiliate link detection and FTC disclosure utilities.
// Detection runs on review content before DB write — if links are found,
// the form blocks submission until the user acknowledges the disclosure.

const AFFILIATE_PATTERNS: RegExp[] = [
  /amzn\.to/i,
  /amazon\.com.*[?&]tag=/i,
  /shareasale\.com/i,
  /clickbank\.net/i,
  /hop\.clickbank\.net/i,
  /jvzoo\.com/i,
  /geni\.us/i,
  /bossdaddylife\.com\/go\//i,
]

export function detectAffiliateLinks(content: string): boolean {
  return AFFILIATE_PATTERNS.some((pattern) => pattern.test(content))
}

export function extractAffiliateNetwork(url: string): string {
  if (/amazon|amzn/i.test(url)) return 'amazon'
  if (/shareasale/i.test(url)) return 'shareasale'
  if (/clickbank/i.test(url)) return 'clickbank'
  if (/jvzoo/i.test(url)) return 'jvzoo'
  return 'other'
}

export const FTC_DISCLOSURE_HTML =
  '<p class="bd-disclosure-inline">This article contains affiliate links. ' +
  'As an Amazon Associate I earn from qualifying purchases. ' +
  'We may earn a small commission at no extra cost to you. ' +
  '<a href="/affiliate-disclosure/" rel="noopener">Learn more</a></p>'
