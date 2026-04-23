import Link from 'next/link'
import { ImageGeneratorStudio } from './_components/ImageGeneratorStudio'

export default function GenerateImagePage() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <Link href="/dashboard/images" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-3">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Image Studio
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black">Generate Image</h1>
        <p className="text-gray-500 text-sm mt-1">Write a prompt, generate an image, save to the library.</p>
      </div>

      <ImageGeneratorStudio />
    </div>
  )
}
