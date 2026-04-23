'use client'

import { useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  if (!text.trim()) return 0
  return text.split(/\s+/).length
}

export function ContentEditor({ value, onChange, placeholder, rows = 20 }: Props) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  const plain = stripTags(value)
  const wordCount = countWords(plain)
  const readMin = Math.max(1, Math.round(wordCount / 225))

  return (
    <div className="space-y-2">
      {/* Tabs + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setTab('edit')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              tab === 'edit' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              tab === 'preview' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Preview
          </button>
        </div>
        <div className="text-xs text-gray-600 font-mono">
          {wordCount.toLocaleString()} words · {readMin} min read
        </div>
      </div>

      {/* Edit or Preview pane */}
      {tab === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder ?? '<p>Write your content here using HTML...</p>'}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y font-mono text-sm"
        />
      ) : (
        <div
          className="prose prose-invert prose-sm max-w-none bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[320px] overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: value || '<p class="text-gray-600 italic">Nothing to preview yet.</p>' }}
        />
      )}
    </div>
  )
}
