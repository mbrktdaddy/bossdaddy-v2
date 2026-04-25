'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  targetWords?: number
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  if (!text.trim()) return 0
  return text.split(/\s+/).length
}

const TOOLBAR_ACTIONS = [
  { label: 'B',  title: 'Bold',        before: '<strong>', after: '</strong>' },
  { label: 'I',  title: 'Italic',      before: '<em>',     after: '</em>' },
  { label: 'H2', title: 'Heading 2',   before: '<h2>',     after: '</h2>' },
  { label: 'H3', title: 'Heading 3',   before: '<h3>',     after: '</h3>' },
  { label: 'UL', title: 'Bullet list', before: '<ul>\n  <li>', after: '</li>\n</ul>' },
  { label: '"',  title: 'Blockquote',  before: '<blockquote><p>', after: '</p></blockquote>' },
  { label: 'P',  title: 'Paragraph',   before: '<p>',      after: '</p>' },
] as const

interface SelectionState {
  start: number
  end: number
  text: string
}

export function ContentEditor({ value, onChange, placeholder, rows = 20, targetWords }: Props) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  const plain = stripTags(value)
  const wordCount = countWords(plain)
  const readMin = Math.max(1, Math.round(wordCount / 225))

  // Cmd+Shift+P → toggle edit/preview
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setTab((t) => t === 'edit' ? 'preview' : 'edit')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function captureSelection() {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) { setSelection(null); return }
    setSelection({ start, end, text: value.slice(start, end) })
  }

  function applyFormat(before: string, after: string, title: string) {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)

    let inserted: string
    let cursorOffset: number

    if (title === 'Link') {
      const href = prompt('URL:')
      if (!href) return
      inserted = `<a href="${href}">${selected || 'link text'}</a>`
      cursorOffset = inserted.length
    } else {
      inserted = before + (selected || '') + after
      cursorOffset = selected ? inserted.length : before.length
    }

    const next = value.slice(0, start) + inserted + value.slice(end)
    onChange(next)

    requestAnimationFrame(() => {
      el.focus()
      const pos = start + cursorOffset
      el.setSelectionRange(pos, pos)
    })
  }

  async function handleRefineSelection() {
    if (!selection || !refineInstruction.trim()) return
    setRefining(true)
    setRefineError(null)
    try {
      const res = await fetch('/api/claude/refine-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selection.text, instruction: refineInstruction }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Refinement failed')
      const refined: string = json.refined
      onChange(value.slice(0, selection.start) + refined + value.slice(selection.end))
      setSelection(null)
      setRefineInstruction('')
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : 'Refinement failed')
    }
    setRefining(false)
  }

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
        <div className="text-xs font-mono flex items-center gap-2">
          {targetWords ? (
            <span className={
              wordCount >= targetWords ? 'text-green-500' :
              wordCount >= targetWords * 0.8 ? 'text-yellow-500' :
              'text-gray-600'
            }>
              {wordCount.toLocaleString()} / {targetWords.toLocaleString()} words
            </span>
          ) : (
            <span className="text-gray-600">{wordCount.toLocaleString()} words</span>
          )}
          <span className="text-gray-700">·</span>
          <span className="text-gray-600">{readMin} min read</span>
        </div>
      </div>

      {/* Formatting toolbar — only in edit mode */}
      {tab === 'edit' && (
        <div className="flex items-center gap-1 flex-wrap bg-gray-900/60 border border-gray-800 rounded-xl px-2 py-1.5">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.title}
              type="button"
              title={action.title}
              onClick={() => applyFormat(action.before, action.after, action.title)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors text-gray-400 hover:text-white hover:bg-gray-700 ${
                action.label === 'B' ? 'font-black' : action.label === 'I' ? 'italic' : ''
              }`}
            >
              {action.label}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button
            type="button"
            title="Link"
            onClick={() => applyFormat('', '', 'Link')}
            className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            🔗
          </button>
        </div>
      )}

      {/* Edit or Preview pane */}
      {tab === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
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

      {/* Selection-based AI refine bar */}
      {tab === 'edit' && selection && (
        <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-3 space-y-2">
          <p className="text-xs text-orange-400 font-semibold">
            ✨ Refine selection <span className="text-gray-500 font-normal ml-1">({selection.text.length} chars selected)</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !refining) handleRefineSelection() }}
              placeholder="e.g. 'make this punchier', 'add a statistic', 'shorten'"
              className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
              autoFocus
            />
            <button
              type="button"
              onClick={handleRefineSelection}
              disabled={refining || !refineInstruction.trim()}
              className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {refining ? 'Refining…' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={() => { setSelection(null); setRefineInstruction(''); setRefineError(null) }}
              className="shrink-0 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          {refineError && (
            <p className="text-xs text-red-400">{refineError}</p>
          )}
        </div>
      )}
    </div>
  )
}
