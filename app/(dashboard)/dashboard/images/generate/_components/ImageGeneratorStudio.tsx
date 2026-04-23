'use client'

import { useState } from 'react'

interface SessionImage {
  id?: string
  url: string
  prompt: string
  size: string
}

export function ImageGeneratorStudio() {
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1792x1024')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionImage[]>([])
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) { setError('Enter a prompt first'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), size }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      setSession((s) => [{ id: json.asset.id, url: json.asset.url, prompt: prompt.trim(), size }, ...s])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
    setLoading(false)
  }

  function handleCopyUrl(url: string) {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 1500)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* Left: prompt + controls (sticky on desktop) */}
      <div className="lg:col-span-2 space-y-5 lg:sticky lg:top-4 lg:self-start">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder="Describe the image in detail.

Tips:
- Name specific objects and setting
- Include lighting ('warm natural light', 'soft indoor daylight')
- Specify style ('editorial photography', 'photo-realistic')
- Say what to exclude ('no people', 'no text')"
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none font-mono"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Aspect ratio</label>
          <div className="flex gap-2">
            {[
              { value: '1792x1024', label: 'Landscape', ratio: '16:9' },
              { value: '1024x1024', label: 'Square',    ratio: '1:1'  },
              { value: '1024x1792', label: 'Portrait',  ratio: '9:16' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSize(opt.value as typeof size)}
                className={`flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-xl transition-colors ${
                  size === opt.value
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-xs opacity-70 font-mono">{opt.ratio}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full px-5 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? '✨ Generating…' : '✨ Generate'}
        </button>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <p className="text-xs text-gray-600">
          Generated images are automatically saved to your media library.
        </p>
      </div>

      {/* Right: session history */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600 font-medium uppercase tracking-widest">This Session</p>
          <span className="text-xs text-gray-500">{session.length} image{session.length !== 1 ? 's' : ''}</span>
        </div>

        {session.length === 0 ? (
          <div className="border-2 border-dashed border-gray-800 rounded-2xl py-20 flex flex-col items-center gap-3 text-gray-600">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Your generated images will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {session.map((img, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.prompt} className="w-full object-contain bg-gray-950 max-h-[500px]" />
                <div className="p-4 space-y-2">
                  <p className="text-xs text-gray-500 font-mono leading-relaxed">{img.prompt}</p>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs text-gray-600 font-mono">{img.size}</span>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(img.url)}
                      className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                    >
                      {copiedUrl === img.url ? '✓ Copied' : 'Copy URL'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrompt(img.prompt)}
                      className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                      title="Load this prompt to tweak and regenerate"
                    >
                      ✎ Reuse prompt
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
