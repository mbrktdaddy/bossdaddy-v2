'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Node, mergeAttributes } from '@tiptap/core'
import type { NodeViewProps } from '@tiptap/react'

// ── Figure node ─────────────────────────────────────────────────────────────
// Opaque block: preserves all data-* attributes through edit cycles.
// Editing is handled exclusively by InlineMediaPanel, not inline.

function FigureView({ node }: NodeViewProps) {
  const src    = node.attrs.src as string | null
  const alt    = node.attrs.alt as string
  const caption = node.attrs.caption as string
  const isPlaceholder = !src

  return (
    <NodeViewWrapper
      as="figure"
      className={node.attrs.class ?? ''}
      data-slot-id={node.attrs['data-slot-id']}
      data-prompt={node.attrs['data-prompt']}
      data-alt={node.attrs['data-alt']}
      data-caption={node.attrs['data-caption']}
      contentEditable={false}
      style={{ userSelect: 'none' }}
    >
      {isPlaceholder ? (
        <div className="bd-image-placeholder">
          <figcaption className="text-gray-500 text-sm">🖼 {caption || 'Image placeholder — fill via the Media panel'}</figcaption>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="rounded-lg max-w-full" />
          {caption && <figcaption>{caption}</figcaption>}
        </>
      )}
    </NodeViewWrapper>
  )
}

const FigureNode = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      class:            { default: null },
      'data-slot-id':   { default: null },
      'data-prompt':    { default: null },
      'data-alt':       { default: null },
      'data-caption':   { default: null },
      src:              { default: null },
      alt:              { default: '' },
      caption:          { default: '' },
    }
  },

  parseHTML() {
    return [{
      tag: 'figure',
      getAttrs: (element) => {
        const el = element as HTMLElement
        const img        = el.querySelector('img')
        const figcaption = el.querySelector('figcaption')
        return {
          class:            el.getAttribute('class'),
          'data-slot-id':   el.getAttribute('data-slot-id'),
          'data-prompt':    el.getAttribute('data-prompt'),
          'data-alt':       el.getAttribute('data-alt'),
          'data-caption':   el.getAttribute('data-caption'),
          src:              img?.getAttribute('src') ?? null,
          alt:              img?.getAttribute('alt') ?? '',
          caption:          figcaption?.textContent ?? '',
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption, ...figureAttrs } = HTMLAttributes
    const children: (string | Record<string, unknown>)[][] = []
    if (src) children.push(['img', { src, alt }])
    if (caption) children.push(['figcaption', {}, caption as string])
    return ['figure', mergeAttributes(figureAttrs), ...children]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureView)
  },
})

// ── Image gallery wrapper ───────────────────────────────────────────────────
// Preserves <div class="bd-image-grid"> wrappers around galleries — without
// this, Tiptap drops the wrapper and figures float to top level on first edit.

const ImageGridNode = Node.create({
  name: 'imageGrid',
  group: 'block',
  content: 'figure+',

  addAttributes() {
    return {
      'data-slot-id': { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'div.bd-image-grid' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'bd-image-grid' }), 0]
  },
})

// ── Link with affiliate attribute preservation ──────────────────────────────
// Default Link strips data-product-slug and overrides rel. Affiliate anchors
// resolved from [[BUY:slug]] tokens carry rel="sponsored nofollow noopener"
// + data-product-slug — both must survive editor round-trips.

import LinkExtension from '@tiptap/extension-link'

const Link = LinkExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rel: {
        default: 'noopener noreferrer',
        parseHTML: (el) => el.getAttribute('rel'),
        renderHTML: (attrs) => attrs.rel ? { rel: attrs.rel } : {},
      },
      'data-product-slug': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-product-slug'),
        renderHTML: (attrs) => attrs['data-product-slug']
          ? { 'data-product-slug': attrs['data-product-slug'] }
          : {},
      },
    }
  },
})

// ── Link dialog ─────────────────────────────────────────────────────────────

function LinkDialog({ initial, onConfirm, onCancel }: {
  initial: string
  onConfirm: (url: string) => void
  onCancel: () => void
}) {
  const [url, setUrl] = useState(initial)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-white mb-3">Insert link</p>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(url)
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="https://..."
          autoFocus
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 mb-3"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(url)}
            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {url ? 'Insert' : 'Remove link'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number       // kept for API compat — not used directly in Tiptap
  targetWords?: number
}

interface SelectionState {
  from: number
  to: number
  text: string
}

export function TiptapEditor({ value, onChange, placeholder, targetWords }: Props) {
  const lastEmitted     = useRef(value)
  const [linkOpen, setLinkOpen]     = useState(false)
  const [linkCurrent, setLinkCurrent] = useState('')
  const [selection, setSelection]   = useState<SelectionState | null>(null)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiRefining, setAiRefining] = useState(false)
  const [aiError, setAiError]       = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:          { levels: [2, 3, 4] },
        horizontalRule:   false,
        strike:           false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write your review here…' }),
      CharacterCount,
      FigureNode,
      ImageGridNode,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: [
          'prose prose-invert prose-sm max-w-none',
          'prose-headings:font-black prose-headings:font-sans prose-headings:tracking-tight',
          'prose-h2:text-xl prose-h3:text-lg',
          'prose-a:text-orange-400 prose-a:no-underline',
          'prose-p:text-gray-300 prose-li:text-gray-300',
          'prose-strong:text-white prose-blockquote:border-orange-600',
          'min-h-[480px] px-4 py-4 focus:outline-none',
        ].join(' '),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastEmitted.current = html
      onChange(html)
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        setSelection({ from, to, text: editor.state.doc.textBetween(from, to, ' ') })
      } else {
        setSelection(null)
      }
    },
    immediatelyRender: false,
  })

  // Sync external content updates (InlineMediaPanel writes back to `value`)
  useEffect(() => {
    if (!editor) return
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [value, editor])

  const wordCount = editor?.storage.characterCount?.words() ?? 0
  const readMin   = Math.max(1, Math.round(wordCount / 225))

  function openLinkDialog() {
    if (!editor) return
    const existing = editor.getAttributes('link').href ?? ''
    setLinkCurrent(existing)
    setLinkOpen(true)
  }

  function applyLink(url: string) {
    if (!editor) return
    setLinkOpen(false)
    if (!url) {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  async function handleAiRefine() {
    if (!editor || !selection || !aiInstruction.trim()) return
    setAiRefining(true)
    setAiError(null)
    try {
      const res = await fetch('/api/claude/refine-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selection.text, instruction: aiInstruction }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Refinement failed')
      editor
        .chain()
        .focus()
        .setTextSelection({ from: selection.from, to: selection.to })
        .insertContent(json.refined)
        .run()
      setSelection(null)
      setAiInstruction('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Refinement failed')
    }
    setAiRefining(false)
  }

  if (!editor) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl min-h-[480px] animate-pulse" />
    )
  }

  const btn = (active: boolean) =>
    `px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`

  return (
    <div className="space-y-2">

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs font-mono">
        {targetWords ? (
          <span className={
            wordCount >= targetWords         ? 'text-green-500' :
            wordCount >= targetWords * 0.8   ? 'text-yellow-500' :
            'text-gray-600'
          }>
            {wordCount.toLocaleString()} / {targetWords.toLocaleString()} words
          </span>
        ) : (
          <span className="text-gray-600">{wordCount.toLocaleString()} words</span>
        )}
        <span className="text-gray-600">{readMin} min read</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap bg-gray-900/60 border border-gray-800 rounded-xl px-2 py-1.5">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
          className={`${btn(editor.isActive('bold'))} font-black`}>B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
          className={`${btn(editor.isActive('italic'))} italic`}>I</button>

        <div className="w-px h-4 bg-gray-700 mx-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}
          className={btn(editor.isActive('heading', { level: 2 }))}>H2</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }}
          className={btn(editor.isActive('heading', { level: 3 }))}>H3</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 4 }).run() }}
          className={btn(editor.isActive('heading', { level: 4 }))}>H4</button>

        <div className="w-px h-4 bg-gray-700 mx-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
          className={btn(editor.isActive('bulletList'))}>UL</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
          className={btn(editor.isActive('orderedList'))}>OL</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }}
          className={btn(editor.isActive('blockquote'))}>❝</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run() }}
          className={btn(editor.isActive('code'))}>{'<>'}</button>

        <div className="w-px h-4 bg-gray-700 mx-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); openLinkDialog() }}
          className={btn(editor.isActive('link'))}>🔗</button>
        {editor.isActive('link') && (
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetLink().run() }}
            className="px-2 py-1 rounded-lg text-xs font-semibold text-red-400 hover:bg-gray-700 transition-colors">✕ link</button>
        )}

        <div className="flex-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run() }}
          disabled={!editor.can().undo()}
          className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Undo (⌘Z)">↩</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run() }}
          disabled={!editor.can().redo()}
          className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Redo (⌘⇧Z)">↪</button>
      </div>

      {/* Editor surface */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 transition-shadow">
        <EditorContent editor={editor} />
      </div>

      {/* Selection-based AI refine */}
      {selection && (
        <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-3 space-y-2">
          <p className="text-xs text-orange-400 font-semibold">
            ✨ Refine selection <span className="text-gray-500 font-normal ml-1">({selection.text.length} chars selected)</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !aiRefining) handleAiRefine() }}
              placeholder="e.g. 'make this punchier', 'add a statistic', 'shorten'"
              autoFocus
              className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button type="button" onClick={handleAiRefine}
              disabled={aiRefining || !aiInstruction.trim()}
              className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
              {aiRefining ? 'Refining…' : 'Apply'}
            </button>
            <button type="button" onClick={() => { setSelection(null); setAiInstruction(''); setAiError(null) }}
              className="shrink-0 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors">
              ✕
            </button>
          </div>
          {aiError && <p className="text-xs text-red-400">{aiError}</p>}
        </div>
      )}

      {linkOpen && (
        <LinkDialog
          initial={linkCurrent}
          onConfirm={applyLink}
          onCancel={() => setLinkOpen(false)}
        />
      )}
    </div>
  )
}
