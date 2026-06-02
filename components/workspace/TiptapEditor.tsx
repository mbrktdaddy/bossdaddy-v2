'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Node, mergeAttributes } from '@tiptap/core'
import type { NodeViewProps } from '@tiptap/react'
import { PHRASE_KINDS, PHRASE_KIND_LABEL, type PhraseKind } from '@/lib/voiceLexicon'

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
          <figcaption className="text-prose-faint text-sm">🖼 {caption || 'Image placeholder — fill via the Media panel'}</figcaption>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60" onClick={onCancel}>
      <div
        className="bg-surface border border-strong rounded-xl p-5 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-prose mb-3">Insert link</p>
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
          className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover mb-3"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(url)}
            className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {url ? 'Insert' : 'Remove link'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-surface-raised hover:bg-surface text-prose-muted text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Collection embed dialog ─────────────────────────────────────────────────
// Searches visible collections and inserts a [[COLLECTION:slug]] token at the
// cursor. Resolved at save time by lib/collection-tokens.ts into a marker div
// that the guide render layer swaps for a <CollectionEmbed> preview.

interface CollectionHit {
  id: string
  slug: string
  title: string
  collection_type: string | null
}

const COLLECTION_TYPE_LABEL: Record<string, string> = {
  general:    'Pick',
  best_of:    'Best Of',
  gift_guide: 'Gift Guide',
  comparison: 'Comparison',
  stack:      'Stack',
}

function CollectionDialog({ onConfirm, onCancel }: {
  onConfirm: (slug: string) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CollectionHit[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/admin/collections/search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setResults((json.collections ?? []) as CollectionHit[])
      } catch { /* ignore */ }
      if (!cancelled) setSearching(false)
    }, q ? 300 : 0)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [q])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-zinc-900/60" onClick={onCancel}>
      <div
        className="bg-surface border border-strong rounded-xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-soft">
          <p className="text-sm font-semibold text-prose mb-3">Insert collection</p>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
            placeholder="Search picks, stacks, comparisons by title or slug…"
            autoFocus
            className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {searching && results.length === 0 ? (
            <p className="text-xs text-prose-faint px-3 py-4">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-prose-faint px-3 py-4">No collections match. Try a shorter or different term.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((c) => {
                const label = COLLECTION_TYPE_LABEL[c.collection_type ?? 'general'] ?? 'Collection'
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onConfirm(c.slug)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-raised/80 text-left transition-colors"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent-text-soft bg-accent-tint border border-accent-border/40 px-2 py-0.5 rounded-full shrink-0">
                        {label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-prose truncate">{c.title}</p>
                        <p className="text-xs text-prose-faint truncate">/{c.slug}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-soft flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-surface-raised hover:bg-surface text-prose-muted text-sm rounded-lg transition-colors"
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
  enableCollectionEmbed?: boolean
}

interface SelectionState {
  from: number
  to: number
  text: string
}

export function TiptapEditor({ value, onChange, placeholder, targetWords, enableCollectionEmbed = false }: Props) {
  const lastEmitted     = useRef(value)
  const [linkOpen, setLinkOpen]     = useState(false)
  const [linkCurrent, setLinkCurrent] = useState('')
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [selection, setSelection]   = useState<SelectionState | null>(null)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiRefining, setAiRefining] = useState(false)
  const [aiError, setAiError]       = useState<string | null>(null)
  const [voiceKind, setVoiceKind]   = useState<PhraseKind>('phrase')
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceSaved, setVoiceSaved] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:          { levels: [2, 3, 4] },
        horizontalRule:   false,
        strike:           false,
        // StarterKit ships a Link extension by default; we use our custom Link
        // (with affiliate attribute preservation) defined below, so disable
        // the built-in to avoid the "Duplicate extension names: ['link']" warning.
        link:             false,
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
          'prose prose-zinc prose-sm max-w-none',
          'prose-headings:font-black prose-headings:font-sans prose-headings:tracking-tight',
          'prose-h2:text-xl prose-h3:text-lg',
          'prose-a:text-accent-text-soft prose-a:no-underline',
          'prose-p:text-prose-muted prose-li:text-prose-muted',
          'prose-strong:text-prose prose-blockquote:border-accent',
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
        setVoiceSaved(false)
      } else {
        setSelection(null)
      }
    },
    immediatelyRender: false,
  })

  // Sync external content updates (InlineMediaPanel writes back to `value`,
  // AI generators replace it wholesale). TipTap's setContent calls flushSync
  // internally; running it inside the effect's render phase trips React 19's
  // "flushSync from a lifecycle method" warning. queueMicrotask defers the
  // commit until after the current render commits, which is what TipTap's
  // own React adapter does. The cancel flag protects against the editor
  // unmounting (or `value` changing again) before the microtask runs.
  useEffect(() => {
    if (!editor) return
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed) return
      editor.commands.setContent(value, { emitUpdate: false })
    })
    return () => { cancelled = true }
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

  // Capture the highlighted line into the author's voice lexicon. The click IS
  // the approval, so it lands `approved` and starts shaping drafts immediately.
  // Kind can be tweaked here; fuller categorization lives in the voice profile.
  async function saveSelectionToVoice() {
    if (!selection?.text.trim()) return
    setVoiceSaving(true)
    setAiError(null)
    try {
      const res = await fetch('/api/voice/phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selection.text.trim(), kind: voiceKind, capture: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setVoiceSaved(true)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not save to your voice')
    }
    setVoiceSaving(false)
  }

  if (!editor) {
    return (
      <div className="bg-surface border border-strong rounded-xl min-h-[480px] animate-pulse" />
    )
  }

  const btn = (active: boolean) =>
    `inline-flex items-center justify-center min-h-[44px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-zinc-800 text-prose' : 'text-prose-muted hover:text-prose hover:bg-zinc-700'}`

  return (
    <div className="space-y-2">

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs font-mono">
        {targetWords ? (
          <span className={
            wordCount >= targetWords         ? 'text-green-500' :
            wordCount >= targetWords * 0.8   ? 'text-amber-700' :
            'text-prose-faint'
          }>
            {wordCount.toLocaleString()} / {targetWords.toLocaleString()} words
          </span>
        ) : (
          <span className="text-prose-faint">{wordCount.toLocaleString()} words</span>
        )}
        <span className="text-prose-faint">{readMin} min read</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap bg-surface/60 border border-soft rounded-xl px-2 py-1.5">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
          className={`${btn(editor.isActive('bold'))} font-black`}>B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
          className={`${btn(editor.isActive('italic'))} italic`}>I</button>

        <div className="w-px h-4 bg-soft mx-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}
          className={btn(editor.isActive('heading', { level: 2 }))}>H2</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }}
          className={btn(editor.isActive('heading', { level: 3 }))}>H3</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 4 }).run() }}
          className={btn(editor.isActive('heading', { level: 4 }))}>H4</button>

        <div className="w-px h-4 bg-soft mx-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
          className={btn(editor.isActive('bulletList'))}>UL</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
          className={btn(editor.isActive('orderedList'))}>OL</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }}
          className={btn(editor.isActive('blockquote'))}>❝</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run() }}
          className={btn(editor.isActive('code'))}>{'<>'}</button>

        <div className="w-px h-4 bg-soft mx-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); openLinkDialog() }}
          className={btn(editor.isActive('link'))}>🔗</button>
        {editor.isActive('link') && (
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetLink().run() }}
            className="px-2 py-1 rounded-lg text-xs font-semibold text-red-700 hover:bg-zinc-700 transition-colors">✕ link</button>
        )}

        {enableCollectionEmbed && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setCollectionOpen(true) }}
            className="px-2 py-1 rounded-lg text-xs font-semibold text-prose-muted hover:bg-zinc-700 transition-colors"
            title="Insert a Boss Daddy collection (pick / stack / comparison) inline"
          >
            + Collection
          </button>
        )}

        <div className="flex-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run() }}
          disabled={!editor.can().undo()}
          className="px-2 py-1 rounded-lg text-xs text-prose-muted hover:text-prose hover:bg-zinc-700 disabled:opacity-30 transition-colors"
          title="Undo (⌘Z)">↩</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run() }}
          disabled={!editor.can().redo()}
          className="px-2 py-1 rounded-lg text-xs text-prose-muted hover:text-prose hover:bg-zinc-700 disabled:opacity-30 transition-colors"
          title="Redo (⌘⇧Z)">↪</button>
      </div>

      {/* Editor surface */}
      <div className="bg-surface border border-strong rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-accent-hover transition-shadow">
        <EditorContent editor={editor} />
      </div>

      {/* Selection-based AI refine */}
      {selection && (
        <div className="bg-accent-tint border border-accent-border/40 rounded-xl p-3 space-y-2">
          <p className="text-xs text-accent-text-soft font-semibold">
            ✨ Refine selection <span className="text-prose-faint font-normal ml-1">({selection.text.length} chars selected)</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !aiRefining) handleAiRefine() }}
              placeholder="e.g. 'make this punchier', 'add a statistic', 'shorten'"
              autoFocus
              className="flex-1 px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
            />
            <button type="button" onClick={handleAiRefine}
              disabled={aiRefining || !aiInstruction.trim()}
              className="shrink-0 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
              {aiRefining ? 'Refining…' : 'Apply'}
            </button>
            <button type="button" onClick={() => { setSelection(null); setAiInstruction(''); setAiError(null) }}
              className="shrink-0 px-3 py-2 bg-surface-raised hover:bg-surface text-prose-muted text-xs rounded-lg transition-colors">
              ✕
            </button>
          </div>

          {/* Capture this line into the author's voice lexicon */}
          <div className="flex items-center gap-2 pt-1 border-t border-accent-border/30">
            <span className="text-xs text-prose-faint">Sounds like you?</span>
            <select
              value={voiceKind}
              onChange={(e) => setVoiceKind(e.target.value as PhraseKind)}
              disabled={voiceSaving || voiceSaved}
              className="px-2 py-1.5 bg-surface-sunken border border-strong rounded-lg text-xs text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-50"
            >
              {PHRASE_KINDS.map((k) => (
                <option key={k} value={k}>{PHRASE_KIND_LABEL[k]}</option>
              ))}
            </select>
            {voiceSaved ? (
              <span className="text-xs text-forest font-semibold">★ Saved to your voice</span>
            ) : (
              <button type="button" onClick={saveSelectionToVoice}
                disabled={voiceSaving}
                className="px-3 py-1.5 bg-surface-raised hover:bg-surface text-accent-text-soft text-xs font-semibold rounded-lg transition-colors disabled:opacity-40">
                {voiceSaving ? 'Saving…' : '★ Save to my voice'}
              </button>
            )}
          </div>

          {aiError && <p className="text-xs text-red-700">{aiError}</p>}
        </div>
      )}

      {linkOpen && (
        <LinkDialog
          initial={linkCurrent}
          onConfirm={applyLink}
          onCancel={() => setLinkOpen(false)}
        />
      )}

      {collectionOpen && (
        <CollectionDialog
          onConfirm={(slug) => {
            setCollectionOpen(false)
            if (!editor) return
            // Insert the token on its own line. resolveCollectionTokens() at
            // save time will swap it for the bd-collection-embed marker div.
            editor.chain().focus().insertContent({
              type: 'paragraph',
              content: [{ type: 'text', text: `[[COLLECTION:${slug}]]` }],
            }).run()
          }}
          onCancel={() => setCollectionOpen(false)}
        />
      )}
    </div>
  )
}
