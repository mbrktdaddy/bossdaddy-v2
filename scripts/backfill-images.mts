/**
 * Backfill hero + inline section images for approved articles and reviews.
 *
 * Usage:
 *   npx dotenv -e .env.local -- tsx scripts/backfill-images.mts
 *
 * What it does:
 *   Articles — adds hero image_url if missing, then injects <figure><img> after
 *              each <h2> section in the content (skips sections already imaged)
 *   Reviews  — adds hero image_url if missing
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiKey    = process.env.OPENAI_API_KEY!

if (!supabaseUrl || !serviceKey || !openaiKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)
const openai   = new OpenAI({ apiKey: openaiKey })

const SAFE_FALLBACK =
  'Editorial stock photo: tools and everyday objects on a clean wooden surface, natural window light, shallow depth of field, no people, no text'

async function generateAndUpload(
  prompt: string,
  bucket: 'article-images' | 'review-images',
  size: '1024x1024' | '1792x1024' = '1024x1024'
): Promise<string> {
  let b64: string | undefined

  // Try original prompt, fall back to safe generic on content policy block
  for (const p of [prompt, SAFE_FALLBACK]) {
    try {
      const res = await openai.images.generate({
        model: 'dall-e-3',
        prompt: p,
        n: 1,
        size,
        quality: 'standard',
        style: 'natural',
        response_format: 'b64_json',
      })
      b64 = res.data?.[0]?.b64_json
      break
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'content_policy_violation' && p !== SAFE_FALLBACK) {
        console.warn('    ⚠ Content filter hit, retrying with fallback prompt')
        continue
      }
      throw err
    }
  }

  if (!b64) throw new Error('No image data returned')

  const buffer   = Buffer.from(b64, 'base64')
  const filename = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: 'image/png', upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename)
  return publicUrl
}

function heroPromptForArticle(title: string, category: string, excerpt: string | null): string {
  return `Editorial stock photo: ${title}. ${excerpt ?? ''} Category: ${category}. ` +
    `Real-world setting with natural or warm indoor lighting, clean composition, sharp focus, ` +
    `no people, no text, no watermarks. Style: professional lifestyle photography as seen on major content sites.`
}

function sectionPromptForArticle(heading: string, title: string, category: string): string {
  return `Editorial stock photo illustrating "${heading}" for an article about ${title} (${category}). ` +
    `Realistic objects or setting relevant to the topic, natural lighting, clean background, ` +
    `no people, no text, no artistic filters. Style: stock photography from Getty or Unsplash.`
}

/** Inject <figure><img> after each <h2> section that doesn't already have one. */
function injectSectionImages(html: string, imageUrls: string[]): string {
  let imageIndex = 0
  // Match each <h2>...</h2> block followed by one or more <p>...</p>, not already followed by <figure>
  return html.replace(
    /(<h2>[^<]*<\/h2>(?:\s*<p>[\s\S]*?<\/p>)+)(?!\s*<figure>)/g,
    (match, block) => {
      if (imageIndex >= imageUrls.length) return match
      const url = imageUrls[imageIndex++]
      // Extract h2 text for alt attribute
      const altMatch = block.match(/<h2>([^<]*)<\/h2>/)
      const alt = altMatch ? altMatch[1] : 'Article image'
      return `${block}\n<figure><img src="${url}" alt="${alt}" /></figure>`
    }
  )
}

// ── Articles ─────────────────────────────────────────────────────────────────

async function backfillArticles() {
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, category, excerpt, content, image_url')
    .eq('status', 'approved')

  if (error) { console.error('Failed to fetch articles:', error.message); return }
  if (!articles?.length) { console.log('No approved articles found.'); return }

  console.log(`Processing ${articles.length} articles...\n`)

  for (const article of articles) {
    const needsHero    = !article.image_url
    const needsSections = !article.content.includes('<figure>')

    if (!needsHero && !needsSections) {
      console.log(`  — Skipping (already has hero + section images): ${article.title}`)
      continue
    }

    console.log(`  ↻ ${article.title}`)

    const updates: Record<string, string> = {}

    try {
      // Hero image
      if (needsHero) {
        const heroUrl = await generateAndUpload(
          heroPromptForArticle(article.title, article.category, article.excerpt),
          'article-images',
          '1792x1024'
        )
        updates.image_url = heroUrl
        console.log(`    ✓ Hero image`)
        await new Promise(r => setTimeout(r, 400))
      }

      // Section images — find <h2> headings, cap at 3
      if (needsSections) {
        const headings = [...article.content.matchAll(/<h2>([^<]*)<\/h2>/g)]
          .map(m => m[1])
          .slice(0, 3)

        if (headings.length > 0) {
          const sectionUrls: string[] = []
          for (const heading of headings) {
            const url = await generateAndUpload(
              sectionPromptForArticle(heading, article.title, article.category),
              'article-images',
              '1024x1024'
            )
            sectionUrls.push(url)
            console.log(`    ✓ Section image: "${heading}"`)
            await new Promise(r => setTimeout(r, 400))
          }
          updates.content = injectSectionImages(article.content, sectionUrls)
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('articles').update(updates).eq('id', article.id)
      }

    } catch (err) {
      console.error(`    ✗ Failed:`, err)
    }
  }
}

// ── Reviews ──────────────────────────────────────────────────────────────────

async function backfillReviews() {
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, title, product_name, category, excerpt, image_url')
    .eq('status', 'approved')
    .is('image_url', null)

  if (error) { console.error('Failed to fetch reviews:', error.message); return }
  if (!reviews?.length) { console.log('No reviews need hero images.'); return }

  console.log(`\nProcessing ${reviews.length} reviews...\n`)

  for (const review of reviews) {
    const prompt =
      `Editorial stock photo of the ${review.product_name}. ` +
      `${review.excerpt ?? ''} Category: ${review.category}. ` +
      `Product in a realistic real-world setting, natural lighting, clean composition, ` +
      `no people, no text. Style: professional product photography as seen on major review sites.`

    try {
      const imageUrl = await generateAndUpload(prompt, 'review-images', '1792x1024')
      await supabase.from('reviews').update({ image_url: imageUrl }).eq('id', review.id)
      console.log(`  ✓ Review: ${review.title}`)
    } catch (err) {
      console.error(`  ✗ Review "${review.title}":`, err)
    }
    await new Promise(r => setTimeout(r, 400))
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('Starting image backfill...\n')
await backfillArticles()
await backfillReviews()
console.log('\nDone.')
