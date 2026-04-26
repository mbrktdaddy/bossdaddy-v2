import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FTC_DISCLOSURE_HTML } from '@/lib/affiliate'
import { getCategoryBySlug } from '@/lib/categories'
import ShareButtons from '@/components/ShareButtons'
import ViewTracker from '@/components/ViewTracker'
import LikeButton from '@/components/LikeButton'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'
import ImageLightbox from '@/components/ImageLightbox'
import { EmailSignup } from '@/components/EmailSignup'
import TableOfContents from '@/components/TableOfContents'
import AuthorBio from '@/components/AuthorBio'
import EngagementTracker from '@/components/EngagementTracker'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('articles')
    .select('title, excerpt, meta_title, meta_description')
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()

  if (!data) return { title: 'Article Not Found' }

  const pageTitle       = data.meta_title?.trim()       || data.title
  const pageDescription = data.meta_description?.trim() || data.excerpt || undefined

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const canonicalUrl = `${siteUrl}/articles/${slug}`
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(data.title)}&type=article`

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: pageTitle, description: pageDescription, type: 'article', url: canonicalUrl, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: pageTitle, description: pageDescription, images: [ogImage] },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: article } = await supabase
    .from('articles')
    .select('id, title, slug, category, content, excerpt, image_url, has_affiliate_links, published_at, reading_time_minutes, profiles(username)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()

  if (!article) notFound()

  // Related articles — same category, exclude current
  const { data: related } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, reading_time_minutes')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', article.category)
    .neq('slug', slug)
    .order('published_at', { ascending: false })
    .limit(3)

  const profileData = Array.isArray(article.profiles)
    ? article.profiles[0]
    : (article.profiles as unknown as { username: string } | null)
  const author = profileData?.username ?? 'Boss Daddy'
  const category = getCategoryBySlug(article.category ?? '')

  return (
    <>
      <ViewTracker id={article.id} type="article" />
      <EngagementTracker contentType="article" contentId={article.id} />
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 text-sm text-gray-400 mb-8 flex-wrap">
          <Link href="/articles" className="py-2 inline-block hover:text-white transition-colors">← Articles</Link>
          {category && (
            <>
              <span className="text-gray-700">/</span>
              <Link href={`/articles?category=${category.slug}`} className={`py-2 inline-block hover:text-white transition-colors ${category.accent}`}>
                {category.icon} {category.label}
              </Link>
            </>
          )}
        </div>

        {/* FTC Disclosure — rendered whenever the article contains affiliate links */}
        {article.has_affiliate_links && (
          <div
            className="mb-8 text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
            dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
          />
        )}

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-6">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 pb-6 border-b border-gray-800">
            <span>by <Link href={`/author/${author}`} className="text-gray-300 hover:text-orange-400 transition-colors">@{author}</Link></span>
            {article.published_at && (
              <span>
                {new Date(article.published_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
            {article.reading_time_minutes && (
              <span>{article.reading_time_minutes} min read</span>
            )}
          </div>
        </div>

        {/* Hero image */}
        {article.image_url && (
          <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-10 bg-gray-900">
            <Image
              src={article.image_url}
              alt={article.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        {/* Table of contents — only renders if the article has 3+ H2/H3 headings */}
        <div className="mb-10">
          <TableOfContents />
        </div>

        {/* Article body */}
        <div className="overflow-x-auto min-w-0 w-full">
          <ImageLightbox className="bd-content">
            <div
              className="bd-editorial prose prose-lg prose-invert prose-orange max-w-none
                prose-headings:font-black prose-headings:tracking-tight prose-headings:font-sans
                prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
                prose-p:text-gray-300 prose-p:leading-[1.75]
                prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
                prose-strong:text-white
                prose-li:text-gray-300 prose-li:leading-[1.75]"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </ImageLightbox>
        </div>

        {/* Bottom CTA — email signup */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-orange-900/30 rounded-2xl p-6 sm:p-8 text-center">
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Liked this article?</p>
            <h3 className="text-xl font-black mb-2">Get the next one in your inbox</h3>
            <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
              One email when there&apos;s actually something worth saying. Plus dad-tested gear picks before they go up.
            </p>
            <div className="max-w-md mx-auto">
              <EmailSignup
                heading={null}
                description={null}
                buttonLabel="Sign me up"
                successMessage="You're in. Welcome to the crew."
                interests={['newsletter']}
              />
            </div>
            <Link
              href="/reviews"
              className="inline-block mt-5 text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors"
            >
              Or browse the review catalog →
            </Link>
          </div>
        </div>

        {/* Like + Share */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex items-center justify-between flex-wrap gap-4">
          <LikeButton contentType="article" contentId={article.id} />
          <ShareButtons title={article.title} />
        </div>

        {/* Author bio */}
        <AuthorBio username={author} />

        {/* Comments */}
        <div className="mt-12">
          <h2 className="text-lg font-black mb-6">Comments</h2>
          <CommentList contentType="article" contentId={article.id} />
          <div className="mt-6">
            <CommentForm contentType="article" contentId={article.id} />
          </div>
        </div>

        {/* Related articles */}
        {related && related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-black mb-4">More Articles</h2>
            <div className="space-y-2">
              {related.map((a) => (
                <Link
                  key={a.id}
                  href={`/articles/${a.slug}`}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-orange-700/50 rounded-2xl transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors truncate">{a.title}</p>
                    {a.excerpt && <p className="text-xs text-gray-400 mt-0.5 truncate">{a.excerpt}</p>}
                  </div>
                  {a.reading_time_minutes && (
                    <span className="text-xs text-gray-500 ml-4 shrink-0">{a.reading_time_minutes} min</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
