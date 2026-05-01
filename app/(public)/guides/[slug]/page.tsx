import { cache } from 'react'
import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FTC_DISCLOSURE_HTML } from '@/lib/affiliate'
import { getCategoryBySlug } from '@/lib/categories'
import ShareButtons from '@/components/ShareButtons'
import ViewTracker from '@/components/ViewTracker'
import LikeButton from '@/components/LikeButton'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'
import ImageLightbox from '@/components/ImageLightbox'
import { LightboxImage } from '@/components/LightboxImage'
import { EmailSignup } from '@/components/EmailSignup'
import AuthorBio from '@/components/AuthorBio'

const TableOfContents = dynamic(() => import('@/components/TableOfContents'))
const EngagementTracker = dynamic(() => import('@/components/EngagementTracker'))

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guides')
    .select('slug')
    .eq('status', 'approved')
    .eq('is_visible', true)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

const getGuide = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('guides')
    .select('id, title, slug, category, content, excerpt, image_url, has_affiliate_links, published_at, reading_time_minutes, meta_title, meta_description, profiles(username)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()
  return data
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getGuide(slug)

  if (!data) return { title: 'Guide Not Found' }

  const pageTitle       = data.meta_title?.trim()       || data.title
  const pageDescription = data.meta_description?.trim() || data.excerpt || undefined

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const canonicalUrl = `${siteUrl}/guides/${slug}`
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(data.title)}&type=guide`

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: pageTitle, description: pageDescription, type: 'article', url: canonicalUrl, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: pageTitle, description: pageDescription, images: [ogImage] },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = await getGuide(slug)

  if (!guide) notFound()

  const supabase = await createClient()

  // Related guides — same category, exclude current
  const { data: related } = await supabase
    .from('guides')
    .select('id, slug, title, excerpt, reading_time_minutes')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', guide.category)
    .neq('slug', slug)
    .order('published_at', { ascending: false })
    .limit(3)

  const profileData = Array.isArray(guide.profiles)
    ? guide.profiles[0]
    : (guide.profiles as unknown as { username: string } | null)
  const author = profileData?.username ?? 'Boss Daddy'
  const category = getCategoryBySlug(guide.category ?? '')

  return (
    <>
      <ViewTracker id={guide.id} type="guide" />
      <EngagementTracker contentType="guide" contentId={guide.id} />
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 text-sm text-gray-400 mb-8 flex-wrap">
          <Link href="/guides" className="py-2 inline-block hover:text-white transition-colors">← Guides</Link>
          {category && (
            <>
              <span className="text-gray-700">/</span>
              <Link href={`/guides?category=${category.slug}`} className={`py-2 inline-block hover:text-white transition-colors ${category.accent}`}>
                {category.icon} {category.label}
              </Link>
            </>
          )}
        </div>

        {/* FTC Disclosure — rendered whenever the guide contains affiliate links */}
        {guide.has_affiliate_links && (
          <div
            className="mb-8 text-xs text-gray-500 bg-gray-900 rounded-2xl px-4 py-3 shadow-md shadow-black/30"
            dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
          />
        )}

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-6">{guide.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 pb-6">
            <span>by <Link href={`/author/${author}`} className="text-gray-300 hover:text-orange-400 transition-colors">@{author}</Link></span>
            {guide.published_at && (
              <span>
                {new Date(guide.published_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
            {guide.reading_time_minutes && (
              <span>{guide.reading_time_minutes} min read</span>
            )}
          </div>
        </div>

        {/* Hero image */}
        {guide.image_url && (
          <LightboxImage src={guide.image_url} alt={guide.title}>
            <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-10 bg-gray-900">
              <Image
                src={guide.image_url}
                alt={guide.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          </LightboxImage>
        )}

        {/* Table of contents — only renders if the guide has 3+ H2/H3 headings */}
        <div className="mb-10">
          <TableOfContents />
        </div>

        {/* Guide body */}
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
              dangerouslySetInnerHTML={{ __html: guide.content }}
            />
          </ImageLightbox>
        </div>

        {/* Bottom CTA — email signup */}
        <div className="mt-12 pt-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 sm:p-8 text-center shadow-xl shadow-black/40">
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Liked this guide?</p>
            <h3 className="text-xl font-black mb-2">Get the next one in your inbox</h3>
            <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
              One email when there&apos;s actually something worth saying. Plus dad-tested stuff before they go up.
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
              Or browse the review catalog
            </Link>
          </div>
        </div>

        {/* Like + Share */}
        <div className="mt-8 pt-6 flex items-center justify-between flex-wrap gap-4">
          <LikeButton contentType="guide" contentId={guide.id} />
          <ShareButtons title={guide.title} />
        </div>

        {/* Author bio */}
        <AuthorBio username={author} />

        {/* Comments */}
        <div className="mt-12">
          <h2 className="text-lg font-black mb-6">Comments</h2>
          <CommentList contentType="guide" contentId={guide.id} />
          <div className="mt-6">
            <CommentForm contentType="guide" contentId={guide.id} />
          </div>
        </div>

        {/* Related guides */}
        {related && related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-black mb-4">More Guides</h2>
            <div className="space-y-2">
              {related.map((a) => (
                <Link
                  key={a.id}
                  href={`/guides/${a.slug}`}
                  className="flex items-center justify-between p-4 bg-gray-900 rounded-2xl shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40 transition-all group"
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
