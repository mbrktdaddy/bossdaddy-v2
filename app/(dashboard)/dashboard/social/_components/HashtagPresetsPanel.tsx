'use client'

import { useState } from 'react'

export interface HashtagPreset {
  id: string
  name: string
  platform: string
  tags: string[]
  created_at: string
}

interface Props {
  presets: HashtagPreset[]
  platform: string
  onPresetsChange: (presets: HashtagPreset[]) => void
}

export default function HashtagPresetsPanel({ presets, platform, onPresetsChange }: Props) {
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function save() {
    const tags = tagsInput.split(/[\s,]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean)
    if (!name.trim() || tags.length === 0) { setError('Name and at least one tag required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/hashtag-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, name: name.trim(), tags }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Save failed'); return }
    onPresetsChange([...presets, json.preset])
    setName(''); setTagsInput(''); setOpen(false)
  }

  async function remove(id: string) {
    await fetch(`/api/hashtag-presets/${id}`, { method: 'DELETE' })
    onPresetsChange(presets.filter((p) => p.id !== id))
  }

  if (presets.length === 0 && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-prose-faint hover:text-accent-text-soft transition-colors"
      >
        + Save hashtag preset
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-prose-muted uppercase tracking-widest font-medium">Hashtag Presets</p>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-accent-text-soft hover:text-accent transition-colors"
        >
          {open ? 'Cancel' : '+ New preset'}
        </button>
      </div>

      {/* Saved presets */}
      {presets.length > 0 && (
        <div className="space-y-1.5">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-start justify-between gap-2 bg-surface rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-prose font-medium">{preset.name}</p>
                <p className="text-xs text-prose-faint truncate">{preset.tags.map((t) => `#${t}`).join(' ')}</p>
              </div>
              <button
                onClick={() => remove(preset.id)}
                className="text-prose-faint hover:text-danger-ink transition-colors shrink-0 mt-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New preset form */}
      {open && (
        <div className="bg-surface border border-strong rounded-xl p-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name (e.g. Dad Life)"
            className="w-full bg-surface-raised border border-strong text-prose text-xs rounded-lg px-3 py-2 focus:border-accent focus:outline-none"
          />
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="#DadLife #BossDaddy #FatherFirst"
            className="w-full bg-surface-raised border border-strong text-prose text-xs rounded-lg px-3 py-2 focus:border-accent focus:outline-none"
          />
          {error && <p className="text-xs text-danger-ink">{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Preset'}
          </button>
        </div>
      )}
    </div>
  )
}
