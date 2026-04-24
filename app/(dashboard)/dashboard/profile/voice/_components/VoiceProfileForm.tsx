'use client'

import { useMemo, useState } from 'react'
import type { VoiceFact, VoiceProfile } from '@/lib/voiceProfile'

interface Props {
  initial: Pick<
    VoiceProfile,
    'self_dob' | 'wife_dob' | 'daughter_dob' | 'occupation' | 'faith_values' | 'region' | 'facts'
  >
}

function ageFromDob(dob: string | null): string {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  let years = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1
  return years >= 0 ? `${years} years` : ''
}

function newFactId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function VoiceProfileForm({ initial }: Props) {
  const [selfDob, setSelfDob]         = useState<string>(initial.self_dob ?? '')
  const [wifeDob, setWifeDob]         = useState<string>(initial.wife_dob ?? '')
  const [daughterDob, setDaughterDob] = useState<string>(initial.daughter_dob ?? '')
  const [occupation, setOccupation]   = useState<string>(initial.occupation ?? '')
  const [faithValues, setFaithValues] = useState<string>(initial.faith_values ?? '')
  const [region, setRegion]           = useState<string>(initial.region ?? '')
  const [facts, setFacts]             = useState<VoiceFact[]>(initial.facts ?? [])

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const selfAge     = useMemo(() => ageFromDob(selfDob), [selfDob])
  const wifeAge     = useMemo(() => ageFromDob(wifeDob), [wifeDob])
  const daughterAge = useMemo(() => ageFromDob(daughterDob), [daughterDob])

  function updateFact(id: string, patch: Partial<VoiceFact>) {
    setFacts((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function addFact() {
    setFacts((list) => [...list, { id: newFactId(), label: '', value: '' }])
  }

  function removeFact(id: string) {
    setFacts((list) => list.filter((f) => f.id !== id))
  }

  async function handleSave() {
    setSaving(true); setError(null); setSavedAt(null)
    try {
      const res = await fetch('/api/voice-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          self_dob:     selfDob || null,
          wife_dob:     wifeDob || null,
          daughter_dob: daughterDob || null,
          occupation:   occupation || null,
          faith_values: faithValues || null,
          region:       region || null,
          facts:        facts.map((f) => ({ id: f.id, label: f.label ?? '', value: f.value ?? '' })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Dates of birth ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black mb-1">Family dates of birth</h2>
          <p className="text-xs text-gray-500">
            Stored as dates so Claude computes current ages on every draft — no yearly edits.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DobField label="Your DOB" value={selfDob} onChange={setSelfDob} age={selfAge} />
          <DobField label="Wife's DOB" value={wifeDob} onChange={setWifeDob} age={wifeAge} />
          <DobField label="Daughter's DOB" value={daughterDob} onChange={setDaughterDob} age={daughterAge} />
        </div>
      </section>

      {/* ── Core text fields ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black mb-1">About you</h2>
          <p className="text-xs text-gray-500">
            Claude references these verbatim when context helps (&ldquo;as a {occupation || 'remote-working dad'}
            &rdquo;). Leave blank to exclude.
          </p>
        </div>

        <TextField
          label="Occupation"
          placeholder="e.g. software engineer, contractor, stay-at-home dad"
          value={occupation}
          onChange={setOccupation}
        />
        <TextAreaField
          label="Faith / values"
          placeholder="e.g. Christian; we prioritize family time over new stuff"
          value={faithValues}
          onChange={setFaithValues}
        />
        <TextField
          label="Region"
          placeholder="e.g. Pacific Northwest, US; Southern Ontario"
          value={region}
          onChange={setRegion}
        />
      </section>

      {/* ── Evolving facts list ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black mb-1">Additional facts</h2>
            <p className="text-xs text-gray-500">
              Anything else Claude should treat as ground truth — testing philosophy, gear you already
              own, products you refuse to endorse, recurring references. Add freely, remove anytime.
            </p>
          </div>
          <button
            onClick={addFact}
            type="button"
            className="shrink-0 text-xs px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-colors"
          >
            + Add fact
          </button>
        </div>

        {facts.length === 0 && (
          <p className="text-sm text-gray-600 italic">
            No additional facts yet. Click <strong>+ Add fact</strong> to start.
          </p>
        )}

        <div className="space-y-3">
          {facts.map((f) => (
            <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-3">
                <input
                  type="text"
                  value={f.label}
                  onChange={(e) => updateFact(f.id, { label: e.target.value })}
                  placeholder="Short label (optional) — e.g. Testing approach"
                  className="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={() => removeFact(f.id)}
                  className="text-xs px-2 py-2 text-red-400 hover:text-red-300 transition-colors"
                  title="Remove fact"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={f.value}
                onChange={(e) => updateFact(f.id, { value: e.target.value })}
                placeholder="Fact — e.g. I test every product for at least two weekends before writing the review."
                rows={2}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Save bar ─────────────────────────────────────────────────── */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-gray-950/80 backdrop-blur px-4 py-3 rounded-xl border border-gray-800">
        <div className="min-w-0 text-sm">
          {error && <span className="text-red-400">{error}</span>}
          {!error && savedAt && <span className="text-green-400">✓ Saved at {savedAt}</span>}
          {!error && !savedAt && <span className="text-gray-500">Changes apply to new drafts immediately after saving.</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : 'Save voice profile'}
        </button>
      </div>
    </div>
  )
}

function DobField({ label, value, onChange, age }: {
  label: string
  value: string
  onChange: (v: string) => void
  age: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1.5">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      <p className="mt-1 text-xs text-gray-600">
        {age ? `Currently ${age}` : '—'}
      </p>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
      />
    </div>
  )
}
