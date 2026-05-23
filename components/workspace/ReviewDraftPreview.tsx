'use client'

import { getCategoryBySlug } from '@/lib/categories'
import VerdictCard from '@/components/reviews/VerdictCard'
import TakeawaysCard from '@/components/reviews/TakeawaysCard'
import TrustReceipt from '@/components/reviews/TrustReceipt'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import CategoryIcon from '@/components/CategoryIcon'

interface FAQ { question: string; answer: string }

interface Props {
  title: string
  productName: string
  rating: number
  category: string
  excerpt: string
  content: string
  imageUrl: string | null
  pros: string[]
  cons: string[]
  tldr: string
  keyTakeaways: string[]
  bestFor: string[]
  notFor: string[]
  faqs: FAQ[]
  author: string
  pricePaidCents?: number | null
  testingDuration?: string | null
  scoreQuality?: number | null
  scoreValue?: number | null
  scoreEase?: number | null
  scoreDailyUse?: number | null
  wouldRebuy?: boolean | null
}

export function ReviewDraftPreview({
  title, productName, rating, category, excerpt, content,
  imageUrl, pros, cons, tldr, keyTakeaways, bestFor, notFor, faqs, author,
  pricePaidCents = null, testingDuration = null,
  scoreQuality = null, scoreValue = null, scoreEase = null, scoreDailyUse = null,
  wouldRebuy = null,
}: Props) {
  const cat = getCategoryBySlug(category)
  const subScores = {
    quality: scoreQuality,
    value: scoreValue,
    ease: scoreEase,
    dailyUse: scoreDailyUse,
  }

  return (
    <div className="bg-surface-sunken border border-soft rounded-xl overflow-hidden text-sm">
      {/* Header strip */}
      <div className="bg-surface border-b border-soft px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-prose-faint font-medium">Public preview</span>
        <span className="text-xs text-accent-text-soft/70 font-medium">bossdaddylife.com</span>
      </div>

      <div className="px-5 py-6 space-y-5 overflow-y-auto max-h-[calc(100vh-180px)]">

        {/* Eyebrow */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-accent-text-soft uppercase tracking-widest bg-accent-tint px-2.5 py-0.5 rounded-full">
            {productName || 'Product Name'}
          </span>
          {cat && (
            <span className="flex items-center gap-1 text-xs font-medium text-prose-muted bg-surface px-2.5 py-0.5 rounded-full">
              <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-prose-muted" /> {cat.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-black leading-tight text-prose">
          {title || <span className="text-prose-faint italic">Untitled review</span>}
        </h1>

        {/* Author meta + trust receipt — mirrors the public page layout */}
        <div>
          <p className="text-xs text-prose-faint">by @{author}</p>
          <TrustReceipt
            pricePaidCents={pricePaidCents}
            testingDuration={testingDuration}
            className="mt-1 text-[11px]"
          />
        </div>

        {/* Excerpt */}
        {excerpt && (
          <p className="text-prose-muted text-xs leading-relaxed italic border-l-2 border-soft pl-3">{excerpt}</p>
        )}

        {/* Hero image — moved above verdict to mirror the public page.
            Boss Approved sits as a corner stamp on the image (rating ≥ 8). */}
        {imageUrl && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={productName} className="w-full h-40 object-cover rounded-xl" />
            {rating >= 8 && (
              <div className="absolute top-2 right-2 pointer-events-none">
                <BossApprovedBadge size="sm" variant="card" />
              </div>
            )}
          </div>
        )}

        {/* Verdict — same component readers see, preview variant */}
        <VerdictCard
          variant="preview"
          productName={productName}
          rating={rating}
          tldr={tldr}
          wouldRebuy={wouldRebuy}
          subScores={subScores}
        />

        {/* Key Takeaways — preview variant */}
        <TakeawaysCard items={keyTakeaways} variant="preview" />

        {/* Pros / Cons */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {pros.length > 0 && (
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-forest font-bold uppercase tracking-wide mb-2">✓ Good</p>
                <ul className="space-y-1">
                  {pros.slice(0, 4).map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-prose-muted">
                      <span className="text-green-500 shrink-0">+</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-600 font-bold uppercase tracking-wide mb-2">✗ Bad</p>
                <ul className="space-y-1">
                  {cons.slice(0, 4).map((c, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-prose-muted">
                      <span className="text-red-500 shrink-0">−</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Best For / Not For */}
        {(bestFor.length > 0 || notFor.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {bestFor.length > 0 && (
              <div className="bg-surface rounded-xl p-3">
                <p className="text-xs text-forest uppercase tracking-widest font-semibold mb-2">Best For</p>
                <ul className="space-y-1">
                  {bestFor.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-prose-muted">
                      <span className="text-green-500 shrink-0">+</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notFor.length > 0 && (
              <div className="bg-surface rounded-xl p-3">
                <p className="text-xs text-red-600 uppercase tracking-widest font-semibold mb-2">Not For</p>
                <ul className="space-y-1">
                  {notFor.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-prose-muted">
                      <span className="text-red-500 shrink-0">−</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Article body */}
        {content && (
          <div
            className="prose prose-sm prose-invert prose-orange max-w-none
              prose-headings:font-black prose-headings:font-sans prose-headings:tracking-tight
              prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
              prose-p:text-prose-muted prose-p:leading-relaxed prose-p:text-xs
              prose-a:text-accent-text-soft prose-a:no-underline
              prose-strong:text-prose prose-li:text-xs prose-li:text-prose-muted"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-soft/60">
            <p className="text-xs font-black text-prose">Frequently Asked Questions</p>
            {faqs.map((faq, i) => (
              <div key={i} className="bg-surface rounded-xl p-3">
                <p className="font-bold text-xs text-prose mb-1">{faq.question}</p>
                <p className="text-xs text-prose-muted leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
