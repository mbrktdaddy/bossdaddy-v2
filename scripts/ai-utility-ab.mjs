// Utility-bucket A/B — `npm run ai:ab-utility`.
//
// Decides what the `utility` bucket should point at. Runs the THREE call shapes
// that bucket actually uses, against each candidate model, using the real prompts
// and schemas from the routes (kept in sync by hand — see the header of each test).
//
//   1. alt-text        — VISION + plain text. The decisive test: the bucket is
//                        currently on a non-reasoning xAI model whose image-part
//                        handling has never been verified. A silent degradation
//                        here produces bad alt text with no error.
//   2. product-facts   — structured extraction with a HALLUCINATION TRAP. The
//                        supplied text deliberately omits most preferred spec
//                        labels; inventing values is the failure mode that matters.
//   3. seo-meta        — structured output under hard length limits.
//
// Makes real (paid) calls — a few cents. Dev tool only, not imported by the app.

import { gateway, generateObject, generateText } from 'ai'
import { z } from 'zod'

const CANDIDATES = [
  { slug: 'xai/grok-4.1-fast-non-reasoning', label: 'grok-fast (incumbent)' },
  { slug: 'anthropic/claude-haiku-4.5', label: 'haiku-4.5 (proposed)' },
  { slug: 'anthropic/claude-sonnet-5', label: 'sonnet-5 (bucket default)' },
]

// Real product images from prod storage, with known ground truth so the vision
// output can actually be graded rather than just eyeballed for plausibility.
const IMAGES = [
  {
    truth: 'Ontel "Battery Daddy" battery storage case',
    url: 'https://fsxbertkzcigvkdyqgep.supabase.co/storage/v1/object/public/media/products/a53ee701-808e-4c12-9498-827372b2a3e3/1783967852521-10b1kp.webp',
  },
  {
    truth: 'TERRO Ant Killer Plus (granular ant bait)',
    url: 'https://fsxbertkzcigvkdyqgep.supabase.co/storage/v1/object/public/media/products/015c3bd7-11aa-4b4d-ac8d-008c4995fcea/1783967103278-nrnng0.webp',
  },
]

// ── verbatim from app/api/claude/alt-text/route.ts ──
const ALT_TEXT_INSTRUCTION = `Write concise, accessible alt text for this image for a dad-focused lifestyle blog.

Requirements:
- 1 sentence, 10–20 words
- Describe what's visible — objects, setting, mood
- Do NOT start with "Image of" or "Picture of"
- Good for screen readers — clear, specific, factual
- No quotes, no markdown, just the plain alt text

Return ONLY the alt text, nothing else.`

// ── verbatim from app/api/claude/product-facts/route.ts ──
const PRODUCT_FACTS_SYSTEM = `You extract structured product facts from supplied text.

- Extract ONLY facts explicitly supported by the supplied text. NEVER invent, infer, or estimate a value. If something isn't stated, omit it.
- Prefer the provided preferred labels when the text contains that information, so specs line up across products. Add extra specs only when clearly stated and genuinely useful.
- Values must be concise (a few words, with units) — not sentences.
- "brand" is the manufacturer/brand name only (e.g. "DeWalt"), or null if not clearly stated.`

// The trap: preferred labels ask for six fields; the text states only three
// (brand, capacity, dimensions). Weight, warranty, and material are NOT stated.
// A model that returns values for those is confabulating.
const PREFERRED_LABELS = ['Brand', 'Capacity', 'Dimensions', 'Weight', 'Warranty', 'Material']
const RAW_TEXT = `The Ontel Battery Daddy is a battery organizer and storage case. It holds up to 180
batteries of assorted sizes. The closed case measures 12.5 x 10.5 x 2.5 inches. Includes a
removable battery tester. Double-sided design with a clear lid so you can see what you have.`

const PRODUCT_FACTS_PROMPT = `Extract the brand and product specs from the text below.

Preferred spec labels (use these exact labels when the info is present): ${PREFERRED_LABELS.join(', ')}

Return JSON with this exact shape:
{
  "brand": "string or null",
  "specs": [ { "label": "string", "value": "string" } ]
}

TEXT:
"""
${RAW_TEXT}
"""`

const PRODUCT_FACTS_SCHEMA = z.object({
  brand: z.string().nullable(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
})

const SEO_SCHEMA = z.object({
  metaTitle: z.string(),
  metaDescription: z.string(),
})

const SEO_PROMPT = `Write an SEO meta title and meta description for this article.

Title: "Battery Daddy Review: Is 180-Battery Storage Actually Worth It?"
Excerpt: A dad tests the Ontel Battery Daddy for three months in a cluttered garage — what it fixed, what it didn't, and who should skip it.

Rules:
- metaTitle: max 60 characters
- metaDescription: max 155 characters`

// Every call mirrors the wrappers: cache breakpoint on the system block, a
// surface tag, and the temperature the routes now set explicitly.
function cachedSystem(text) {
  return { role: 'system', content: text, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }
}

function opts(tag) {
  return { providerOptions: { gateway: { tags: [`surface:${tag}`] } } }
}

async function timed(fn) {
  const started = process.hrtime.bigint()
  try {
    const value = await fn()
    return { ok: true, value, ms: Number(process.hrtime.bigint() - started) / 1e6 }
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err), ms: Number(process.hrtime.bigint() - started) / 1e6 }
  }
}

async function altText(slug, image) {
  return timed(async () => {
    const { text, usage } = await generateText({
      model: gateway(slug),
      maxOutputTokens: 120,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image: new URL(image.url) },
          { type: 'text', text: ALT_TEXT_INSTRUCTION },
        ],
      }],
      ...opts('ab-alt-text'),
    })
    return { text: text.trim(), tokens: usage?.totalTokens }
  })
}

async function productFacts(slug) {
  return timed(async () => {
    const { object, usage } = await generateObject({
      model: gateway(slug),
      schema: PRODUCT_FACTS_SCHEMA,
      system: [cachedSystem(PRODUCT_FACTS_SYSTEM)],
      prompt: PRODUCT_FACTS_PROMPT,
      maxOutputTokens: 800,
      temperature: 0,
      ...opts('ab-product-facts'),
    })
    return { object, tokens: usage?.totalTokens }
  })
}

async function seoMeta(slug) {
  return timed(async () => {
    const { object, usage } = await generateObject({
      model: gateway(slug),
      schema: SEO_SCHEMA,
      prompt: SEO_PROMPT,
      maxOutputTokens: 400,
      temperature: 0,
      ...opts('ab-seo-meta'),
    })
    return { object, tokens: usage?.totalTokens }
  })
}

// Labels the source text does NOT support. Any of these coming back is invention.
const UNSUPPORTED = ['weight', 'warranty', 'material']

function gradeFacts(object) {
  const labels = (object.specs ?? []).map((s) => String(s.label).toLowerCase())
  const invented = UNSUPPORTED.filter((u) => labels.some((l) => l.includes(u)))
  return {
    brand: object.brand,
    specCount: labels.length,
    invented,
  }
}

async function main() {
  for (const { slug, label } of CANDIDATES) {
    console.log(`\n${'='.repeat(70)}\n${label}  —  ${slug}\n${'='.repeat(70)}`)

    // 1. VISION
    for (const image of IMAGES) {
      const r = await altText(slug, image)
      console.log(`\n[alt-text] truth: ${image.truth}`)
      if (r.ok) {
        const words = r.value.text.split(/\s+/).filter(Boolean).length
        console.log(`  ok  ${Math.round(r.ms)}ms  ${r.value.tokens ?? '?'}tok  ${words}w`)
        console.log(`  → ${r.value.text}`)
      } else {
        console.log(`  FAIL ${Math.round(r.ms)}ms — ${r.error}`)
      }
    }

    // 2. EXTRACTION + hallucination trap
    const f = await productFacts(slug)
    console.log(`\n[product-facts]`)
    if (f.ok) {
      const g = gradeFacts(f.value.object)
      console.log(`  ok  ${Math.round(f.ms)}ms  ${f.value.tokens ?? '?'}tok`)
      console.log(`  brand: ${JSON.stringify(g.brand)}  specs: ${g.specCount}`)
      console.log(g.invented.length ? `  ⚠ INVENTED: ${g.invented.join(', ')}` : `  ✓ no invented specs`)
      for (const s of f.value.object.specs ?? []) console.log(`     - ${s.label}: ${s.value}`)
    } else {
      console.log(`  FAIL ${Math.round(f.ms)}ms — ${f.error}`)
    }

    // 3. STRUCTURED + length limits
    const s = await seoMeta(slug)
    console.log(`\n[seo-meta]`)
    if (s.ok) {
      const { metaTitle, metaDescription } = s.value.object
      const tOk = metaTitle.length <= 60 ? '✓' : '⚠ OVER'
      const dOk = metaDescription.length <= 155 ? '✓' : '⚠ OVER'
      console.log(`  ok  ${Math.round(s.ms)}ms  ${s.value.tokens ?? '?'}tok`)
      console.log(`  title (${metaTitle.length}/60) ${tOk}: ${metaTitle}`)
      console.log(`  desc  (${metaDescription.length}/155) ${dOk}: ${metaDescription}`)
    } else {
      console.log(`  FAIL ${Math.round(s.ms)}ms — ${s.error}`)
    }
  }
  console.log('\nDone. Grade on: vision accuracy vs truth, invented specs, length compliance, latency.')
}

main()
