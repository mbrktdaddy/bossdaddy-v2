import ArticleForm from '@/components/articles/ArticleForm'

export default function NewArticlePage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black">New Article</h1>
        <p className="text-gray-500 text-sm mt-1">Write a guide, how-to, or opinion piece</p>
      </div>
      <ArticleForm />
    </div>
  )
}
