'use client'

import { getCategoryBySlug } from '@/lib/categories'

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
}

function RatingDot({ rating }: { rating: number }) {
  const color = rating >= 8 ? 'text-green-400' : rating >= 6 ? 'text-yellow-400' : 'text-red-400'
  return (
    <span className={`font-black text-2xl ${color}`}>{rating.toFixed(1)}<span className="text-sm text-gray-500 font-normal">/10</span></span>
  )
}

export function ReviewDraftPreview({
  title, productName, rating, category, excerpt, content,
  imageUrl, pros, cons, tldr, keyTakeaways, bestFor, notFor, faqs, author,
}: Props) {
  const cat = getCategoryBySlug(category)

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden text-sm">
      {/* Header strip */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">Public preview</span>
        <span className="text-xs text-orange-400/70 font-medium">bossdaddylife.com</span>
      </div>

      <div className="px-5 py-6 space-y-5 overflow-y-auto max-h-[calc(100vh-180px)]">

        {/* Eyebrow */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-orange-400 uppercase tracking-widest bg-orange-950/40 px-2.5 py-0.5 rounded-full">
            {productName || 'Product Name'}
          </span>
          {cat && (
            <span className="text-xs font-medium text-gray-400 bg-gray-900 px-2.5 py-0.5 rounded-full">
              {cat.icon} {cat.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-black leading-tight text-white">
          {title || <span className="text-gray-600 italic">Untitled review</span>}
        </h1>

        {/* Rating + meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <RatingDot rating={rating} />
          {rating >= 8 && (
            <span className="text-xs font-bold text-orange-500 bg-orange-950/50 border border-orange-900/50 px-2 py-0.5 rounded-full">
              ✓ Boss Approved
            </span>
          )}
          <span className="text-xs text-gray-500">by @{author}</span>
        </div>

        {/* Excerpt */}
        {excerpt && (
          <p className="text-gray-400 text-xs leading-relaxed italic border-l-2 border-gray-800 pl-3">{excerpt}</p>
        )}

        {/* TL;DR + Key Takeaways */}
        {(tldr || keyTakeaways.length > 0) && (
          <div className="bg-orange-950/30 border border-orange-900/40 rounded-xl p-4 space-y-3">
            {tldr && <p className="text-gray-200 text-xs leading-relaxed">{tldr}</p>}
            {keyTakeaways.length > 0 && (
              <ul className="space-y-1">
                {keyTakeaways.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                    <span className="text-orange-500 shrink-0">→</span>{item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Hero image */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={productName} className="w-full h-40 object-cover rounded-xl" />
        )}

        {/* Pros / Cons */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {pros.length > 0 && (
              <div className="bg-green-950/30 rounded-xl p-3">
                <p className="text-xs text-green-400 font-bold uppercase tracking-wide mb-2">✓ Good</p>
                <ul className="space-y-1">
                  {pros.slice(0, 4).map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-gray-300">
                      <span className="text-green-500 shrink-0">+</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div className="bg-red-950/30 rounded-xl p-3">
                <p className="text-xs text-red-400 font-bold uppercase tracking-wide mb-2">✗ Bad</p>
                <ul className="space-y-1">
                  {cons.slice(0, 4).map((c, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-gray-300">
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
              <div className="bg-gray-900 rounded-xl p-3">
                <p className="text-xs text-green-400 uppercase tracking-widest font-semibold mb-2">Best For</p>
                <ul className="space-y-1">
                  {bestFor.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-gray-300">
                      <span className="text-green-500 shrink-0">+</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notFor.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-3">
                <p className="text-xs text-red-400 uppercase tracking-widest font-semibold mb-2">Not For</p>
                <ul className="space-y-1">
                  {notFor.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-gray-300">
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
              prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-xs
              prose-a:text-orange-400 prose-a:no-underline
              prose-strong:text-white prose-li:text-xs prose-li:text-gray-300"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-gray-800/60">
            <p className="text-xs font-black text-white">Frequently Asked Questions</p>
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-3">
                <p className="font-bold text-xs text-white mb-1">{faq.question}</p>
                <p className="text-xs text-gray-300 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
