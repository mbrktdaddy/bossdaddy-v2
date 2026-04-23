import Link from 'next/link'
import { ArticleCreateWizard } from './_components/ArticleCreateWizard'

export default function NewArticlePage() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/dashboard/articles" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-3">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All articles
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-black">New Article</h1>
        <p className="text-gray-500 text-sm mt-1">Describe your idea, generate the full draft, then edit in the workspace.</p>
      </div>
      <ArticleCreateWizard />
    </div>
  )
}
