// Destination preset catalog for the Savings tool. Two-step picker UX:
// category → specific option. Each preset auto-fills destination_label and
// destination_url so a brand-new user can land a usable destination in two
// taps instead of typing a paypal.me URL or making up a label.
//
// All presets are LABELS + STATIC URLS. We never integrate with the actual
// services — picking "Chase" just labels the destination "Chase savings"
// and (optionally) opens chase.com on Yes tap. Phase 4+ may layer Plaid
// Link on top of bank-category goals for read-only verification.
//
// Naming: statutory / canonical names. "Trump Account" is the legal name
// in IRC §530A (One Big Beautiful Bill Act, 2025). Users can override the
// displayed label freely after picking a preset.

export type DestinationCategory =
  | 'bank'
  | 'payment_app'
  | 'investing'
  | 'cash'
  | 'other'

export interface DestinationPreset {
  id:               string
  category:         DestinationCategory
  label:            string                      // becomes destination_label
  url?:             string                      // becomes destination_url (optional)
  requiresHandle?:  boolean                     // payment apps: prompt for handle/URL
  handleHint?:      string                      // placeholder for the handle field
  suggestsKidTie?:  boolean                     // surface "tie to a kid" nudge
  description?:    string                       // helper copy under the label
}

export interface DestinationCategoryMeta {
  id:           DestinationCategory
  label:        string
  description:  string
}

export const DESTINATION_CATEGORIES: DestinationCategoryMeta[] = [
  { id: 'bank',        label: 'Bank account',          description: 'Your bank or credit union savings.' },
  { id: 'payment_app', label: 'Payment app',           description: 'PayPal, Venmo, Cash App, Zelle.' },
  { id: 'investing',   label: 'Investing / Long-term', description: '529, Trump Account, UTMA, brokerage, retirement.' },
  { id: 'cash',        label: 'Cash / Jar',            description: 'Physical envelope, coin jar, anywhere offline.' },
  { id: 'other',       label: 'Something else',        description: 'Name it yourself.' },
]

export const DESTINATION_PRESETS: DestinationPreset[] = [
  // ── Bank ──────────────────────────────────────────────────────────────────
  { id: 'chase',        category: 'bank', label: 'Chase',            url: 'https://chase.com' },
  { id: 'bofa',         category: 'bank', label: 'Bank of America',  url: 'https://bankofamerica.com' },
  { id: 'wells',        category: 'bank', label: 'Wells Fargo',      url: 'https://wellsfargo.com' },
  { id: 'capital_one',  category: 'bank', label: 'Capital One',      url: 'https://capitalone.com' },
  { id: 'citi',         category: 'bank', label: 'Citi',             url: 'https://citi.com' },
  { id: 'us_bank',      category: 'bank', label: 'U.S. Bank',        url: 'https://usbank.com' },
  { id: 'pnc',          category: 'bank', label: 'PNC',              url: 'https://pnc.com' },
  { id: 'truist',       category: 'bank', label: 'Truist',           url: 'https://truist.com' },
  { id: 'usaa',         category: 'bank', label: 'USAA',             url: 'https://usaa.com' },
  { id: 'marcus',       category: 'bank', label: 'Marcus (Goldman)', url: 'https://marcus.com' },
  { id: 'ally',         category: 'bank', label: 'Ally',             url: 'https://ally.com' },
  { id: 'sofi',         category: 'bank', label: 'SoFi',             url: 'https://sofi.com' },
  { id: 'discover',     category: 'bank', label: 'Discover',         url: 'https://discover.com' },
  { id: 'chime',        category: 'bank', label: 'Chime',            url: 'https://chime.com' },
  { id: 'varo',         category: 'bank', label: 'Varo',             url: 'https://varo.com' },
  { id: 'credit_union', category: 'bank', label: 'Credit union',     description: 'Edit the label below to add your credit union name.' },
  { id: 'bank_other',   category: 'bank', label: 'Other bank',       description: 'Edit the label below to name your bank.' },

  // ── Payment app ───────────────────────────────────────────────────────────
  { id: 'paypal',     category: 'payment_app', label: 'PayPal',     requiresHandle: true, handleHint: 'paypal.me/yourname or pool URL' },
  { id: 'venmo',      category: 'payment_app', label: 'Venmo',      requiresHandle: true, handleHint: '@yourname' },
  { id: 'cashapp',    category: 'payment_app', label: 'Cash App',   requiresHandle: true, handleHint: '$yourtag' },
  { id: 'zelle',      category: 'payment_app', label: 'Zelle',      requiresHandle: true, handleHint: 'phone or email' },
  { id: 'apple_cash', category: 'payment_app', label: 'Apple Cash', description: 'Apple Cash transfers happen inside the Wallet app — no deep link.' },
  { id: 'google_pay', category: 'payment_app', label: 'Google Pay', description: 'Open the Google Pay app to send.' },

  // ── Investing / Long-term ─────────────────────────────────────────────────
  { id: 'plan_529',     category: 'investing', label: '529 Plan',                       suggestsKidTie: true, description: 'State-sponsored education savings plan. Add your specific state plan in the label.' },
  { id: 'trump_account',category: 'investing', label: 'Trump Account',                  suggestsKidTie: true, description: 'Federal child savings account (IRC §530A): $1,000 federal seed + up to $5,000/year family contributions, tax-deferred until 18.' },
  { id: 'utma_ugma',    category: 'investing', label: 'UTMA / UGMA',                    suggestsKidTie: true, description: 'Custodial brokerage account in a child’s name.' },
  { id: 'roth_ira',     category: 'investing', label: 'Roth IRA',                       description: 'Personal Roth — or a kid’s earned-income Roth.' },
  { id: 'brokerage',    category: 'investing', label: 'Brokerage',                      description: 'Fidelity, Schwab, Vanguard, Robinhood, E*TRADE, etc.' },
  { id: 'hsa',          category: 'investing', label: 'HSA',                            description: 'Health Savings Account.' },
  { id: 'plan_401k',    category: 'investing', label: 'Employer 401(k)',                description: 'Workplace retirement plan.' },
  { id: 'invest_other', category: 'investing', label: 'Other retirement / long-term',   description: 'Edit the label below to name your account.' },

  // ── Cash / Jar ────────────────────────────────────────────────────────────
  { id: 'cash_jar',   category: 'cash', label: 'Cash jar' },
  { id: 'envelope',   category: 'cash', label: 'Envelope system' },
  { id: 'coin_jar',   category: 'cash', label: 'Coin jar' },
  { id: 'cash_other', category: 'cash', label: 'Other physical' },
]

export function presetsByCategory(category: DestinationCategory): DestinationPreset[] {
  return DESTINATION_PRESETS.filter((p) => p.category === category)
}

export function presetById(id: string): DestinationPreset | undefined {
  return DESTINATION_PRESETS.find((p) => p.id === id)
}
