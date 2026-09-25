import Link from 'next/link'
import { ImageGeneratorStudio } from './_components/ImageGeneratorStudio'
import { ChevronLeftIcon } from '@/components/icons'

export default function GenerateImagePage() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <Link href="/dashboard/media" className="inline-flex items-center gap-2 text-xs text-prose-faint hover:text-prose transition-colors mb-3">
        <ChevronLeftIcon className="w-3 h-3" strokeWidth={2} />
        Media Library
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black">Generate Image</h1>
        <p className="text-prose-faint text-sm mt-1">Write a prompt, generate an image, save to the library.</p>
      </div>

      <ImageGeneratorStudio />
    </div>
  )
}
