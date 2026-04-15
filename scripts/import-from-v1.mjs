/**
 * Boss Daddy v1 → v2 Import Script
 *
 * Fetches all published posts from bossdaddylife.com (WordPress REST API),
 * reformats each via Claude into the v2 review structure,
 * then inserts into Supabase as approved reviews.
 *
 * Usage:
 *   node scripts/import-from-v1.mjs
 *
 * Requires .env.local to be populated with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env.local')
const envVars = readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=')
    if (!key) return acc
    // Strip inline comments and whitespace
    const raw = rest.join('=').trim()
    const value = raw.split(/\s+#/)[0].trim()
    acc[key.trim()] = value
    return acc
  }, {})

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL']
const SUPABASE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY']
const ANTHROPIC_KEY = envVars['ANTHROPIC_API_KEY']

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('❌ Missing required env vars. Check .env.local')
  process.exit(1)
}

// ── WordPress API ─────────────────────────────────────────────────────────────
const WP_BASE = 'https://bossdaddylife.com/wp-json/wp/v2'

async function fetchV1Posts() {
  const res = await fetch(`${WP_BASE}/posts?per_page=50&status=publish&_fields=id,title,slug,content,excerpt,categories`)
  if (!res.ok) throw new Error(`WP API error: ${res.status}`)
  return res.json()
}

async function fetchV1Categories() {
  const res = await fetch(`${WP_BASE}/categories?per_page=50`)
  if (!res.ok) throw new Error(`WP categories error: ${res.status}`)
  const cats = await res.json()
  return Object.fromEntries(cats.map(c => [c.id, c.name]))
}

// ── Claude reformat ───────────────────────────────────────────────────────────
const CATEGORY_MAP = {
  'BBQ & Grilling': 'bbq-grilling',
  'DIY & Tools': 'diy-tools',
  'Kids & Family': 'kids-family',
  'Health & Fitness': 'health-fitness',
}

const SYSTEM = `You are reformatting content from Boss Daddy Life (bossdaddylife.com) — a dad-tested product review and lifestyle site.

Boss Daddy voice rules:
- First person as a dad: "I tested this...", "After 3 weekends..."
- Confident, direct, no corporate speak
- Light dad humor where natural
- Results-driven: time saved, money saved, family wins

OUTPUT: Return ONLY valid JSON, no markdown, no code fences.`

async function reformatWithClaude(post, categoryName) {
  const rawContent = post.content.rendered.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const excerpt = post.excerpt.rendered.replace(/<[^>]+>/g, '').trim()

  const prompt = `Reformat this Boss Daddy v1 post into v2 review structure.

Original title: ${post.title.rendered}
Category: ${categoryName}
Excerpt: ${excerpt}
Content: ${rawContent.slice(0, 3000)}

Determine if this is a product review or a guide/article.
- If it's a product review: include product_name, rating, pros, cons
- If it's a guide/article: set product_name to the main topic, rating to null, pros/cons to []

Return JSON with exactly this shape:
{
  "title": "string (keep original or improve slightly, max 100 chars)",
  "product_name": "string (product name or article topic)",
  "category": "${CATEGORY_MAP[categoryName] || 'other'}",
  "excerpt": "string (1-2 sentence summary, dad voice, max 200 chars)",
  "content": "string (full HTML content in Boss Daddy voice — use <h2>, <p>, <ul><li> tags, minimum 400 words. CRITICAL: use single quotes for ALL HTML attributes e.g. class='foo' not class=\"foo\". Never use double quotes inside HTML tags.)",
  "rating": number or null (1-5 for product reviews, null for guides),
  "pros": ["string"] (3-5 items for product reviews, [] for guides),
  "cons": ["string"] (2-4 items for product reviews, [] for guides),
  "is_product_review": boolean
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  const text = data.content[0].text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')

  // Sanitize: replace unescaped newlines inside JSON string values
  let jsonStr = jsonMatch[0]
  // Parse safely — if it fails, try stripping control characters
  try {
    return JSON.parse(jsonStr)
  } catch {
    // Remove literal newlines/tabs inside string values
    jsonStr = jsonStr.replace(/[\r\n\t]/g, ' ')
    return JSON.parse(jsonStr)
  }
}

// ── Supabase insert ───────────────────────────────────────────────────────────
async function insertReview(draft, originalSlug) {
  const slug = originalSlug + '-' + Math.random().toString(36).slice(2, 6)

  // Use a fixed admin user ID — we'll use service role which bypasses auth
  // First get the first admin user
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?role=eq.admin&limit=1`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  const profiles = await profileRes.json()
  if (!profiles?.length) throw new Error('No admin user found. Make sure you have an admin account.')
  const authorId = profiles[0].id

  const body = {
    author_id: authorId,
    slug,
    title: draft.title,
    product_name: draft.product_name,
    category: draft.category,
    content: draft.content,
    excerpt: draft.excerpt,
    rating: Math.round(draft.rating ?? 5),
    pros: draft.pros ?? [],
    cons: draft.cons ?? [],
    has_affiliate_links: false,
    disclosure_acknowledged: true,
    status: 'approved',
    published_at: new Date().toISOString(),
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase insert error: ${res.status} ${err}`)
  }

  return res.json()
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting Boss Daddy v1 → v2 import...\n')

  const [posts, categoryMap] = await Promise.all([fetchV1Posts(), fetchV1Categories()])
  console.log(`📦 Found ${posts.length} posts in v1\n`)

  let success = 0
  let failed = 0

  for (const post of posts) {
    const catId = post.categories?.[0]
    const categoryName = catId ? categoryMap[catId] : 'Uncategorized'
    const title = post.title.rendered

    try {
      process.stdout.write(`⏳ Processing: "${title}"...`)

      const draft = await reformatWithClaude(post, categoryName)
      await insertReview(draft, post.slug)

      console.log(` ✅ Done (${draft.is_product_review ? 'review' : 'article'})`)
      success++

      // Rate limit — avoid hammering Claude API
      await new Promise(r => setTimeout(r, 1500))
    } catch (err) {
      console.log(` ❌ Failed: ${err.message}`)
      failed++
    }
  }

  console.log(`\n✅ Import complete: ${success} imported, ${failed} failed`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
