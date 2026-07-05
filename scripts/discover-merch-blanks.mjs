// Discovery helper for Merch Studio Phase 3 — finds candidate Printful catalog
// blank products (tee / mug / hat) so we can pin real IDs in
// lib/merch/printful-catalog.ts. Read-only. Run:
//   node --env-file=.env.local scripts/discover-merch-blanks.mjs
// Optionally pass a product id to dump its variants + print placements:
//   node --env-file=.env.local scripts/discover-merch-blanks.mjs 71

const BASE = 'https://api.printful.com'
const key = process.env.PRINTFUL_API_KEY
if (!key) { console.error('PRINTFUL_API_KEY not set (use --env-file=.env.local)'); process.exit(1) }
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) { throw new Error(`${path} → ${res.status}: ${await res.text()}`) }
  return (await res.json()).result
}

const detailId = process.argv[2]

if (detailId) {
  const { product, variants } = await get(`/products/${detailId}`)
  console.log('PRODUCT', JSON.stringify({ id: product.id, brand: product.brand, model: product.model, type: product.type, title: product.title }, null, 2))
  console.log(`VARIANTS (${variants.length}) — sample:`)
  for (const v of variants.slice(0, 12)) {
    console.log(`  ${v.id}  ${JSON.stringify(v.size)}  ${JSON.stringify(v.color)}`)
  }
  const colors = [...new Set(variants.map((v) => v.color))]
  const sizes = [...new Set(variants.map((v) => v.size))]
  console.log('DISTINCT COLORS:', JSON.stringify(colors))
  console.log('DISTINCT SIZES:', JSON.stringify(sizes))
  try {
    const pf = await get(`/mockup-generator/printfiles/${detailId}`)
    console.log('PLACEMENTS', JSON.stringify(pf.available_placements))
    console.log('PRINTFILES', JSON.stringify(pf.printfiles?.map((p) => ({ id: p.printfile_id, w: p.width, h: p.height, dpi: p.dpi }))))
  } catch (e) { console.log('printfile info error:', e.message) }
  process.exit(0)
}

const all = await get('/products')
console.log(`Catalog has ${all.length} products.\n`)

function show(label, match) {
  const hits = all.filter(match).slice(0, 6)
  console.log(`── ${label} ──`)
  for (const p of hits) {
    console.log(`  id=${p.id}  ${p.brand ?? '—'} ${p.model}  [${p.type}]  variants=${p.variant_count}`)
  }
  console.log('')
}

const t = (p, s) => (p.title || '').toLowerCase().includes(s) || (p.model || '').toLowerCase().includes(s)
show('TEES (Bella+Canvas 3001 / staple)', (p) => t(p, 'bella') || t(p, '3001') || t(p, 'staple tee') || (p.type_name || p.type || '').toUpperCase().includes('T-SHIRT') && t(p, 'unisex'))
show('MUGS (11oz white)', (p) => t(p, 'mug'))
show('HATS / CAPS', (p) => t(p, 'cap') || t(p, 'snapback') || t(p, 'trucker') || t(p, 'dad hat') || t(p, 'beanie'))
