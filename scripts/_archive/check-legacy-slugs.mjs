import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const envVars = readFileSync(envPath, 'utf8')
  .split('\n').filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=')
    if (!key) return acc
    acc[key.trim()] = rest.join('=').trim().split(/\s+#/)[0].trim()
    return acc
  }, {})

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { persistSession: false } }
)

const oldSlug = 'ergobaby-alta-hip-seat-baby-carrier-review-dad-tested-daily-688fca84'

console.log(`Looking up legacy_slugs containing: ${oldSlug}\n`)

const { data, error } = await supabase
  .from('reviews')
  .select('slug, status, is_visible, legacy_slugs')
  .contains('legacy_slugs', [oldSlug])

if (error) {
  console.error('Query error:', error)
  process.exit(1)
}

console.log(`Found ${data.length} matching row(s):`)
for (const r of data) {
  console.log(`  current slug:  ${r.slug}`)
  console.log(`  status:        ${r.status}`)
  console.log(`  is_visible:    ${r.is_visible}`)
  console.log(`  legacy_slugs:  ${JSON.stringify(r.legacy_slugs)}`)
}

// Also try the exact same query the page handler does
console.log('\n--- Mirroring page handler query ---')
const { data: pageQuery, error: pageErr } = await supabase
  .from('reviews')
  .select('slug')
  .contains('legacy_slugs', [oldSlug])
  .eq('status', 'approved')
  .eq('is_visible', true)
  .maybeSingle()

if (pageErr) console.error('Page-handler query error:', pageErr)
console.log('Page-handler query returned:', pageQuery)
