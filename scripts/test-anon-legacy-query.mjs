// Test the legacy_slugs query with the ANON key (same as page handler uses)
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

console.log('Using anon key:', envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']?.slice(0, 30) + '...')
const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  { auth: { persistSession: false } }
)

const oldSlug = 'ergobaby-alta-hip-seat-baby-carrier-review-dad-tested-daily-688fca84'

const { data, error } = await supabase
  .from('reviews')
  .select('slug')
  .contains('legacy_slugs', [oldSlug])
  .eq('status', 'approved')
  .eq('is_visible', true)
  .maybeSingle()

console.log('Anon-key query result:', data)
if (error) console.error('Error:', error)
