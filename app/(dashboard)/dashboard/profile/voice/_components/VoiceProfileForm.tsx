'use client'

import { useState } from 'react'
import type { FamilyMember, Gender, VoiceFact, VoiceProfile } from '@/lib/voiceProfile'

interface Props {
  initial: Pick<
    VoiceProfile,
    'family_members' | 'occupation' | 'faith_values' | 'region' | 'facts'
  >
}

function ageFromDob(dob: string | null): string {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const months = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)))
  if (months < 24) return `${months} months`
  let years = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1
  return years >= 0 ? `${years} years` : ''
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function VoiceProfileForm({ initial }: Props) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(initial.family_members ?? [])
  const [occupation, setOccupation]   = useState<string>(initial.occupation ?? '')
  const [faithValues, setFaithValues] = useState<string>(initial.faith_values ?? '')
  const [region, setRegion]           = useState<string>(initial.region ?? '')
  const [facts, setFacts]             = useState<VoiceFact[]>(initial.facts ?? [])

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  function updateMember(id: string, patch: Partial<FamilyMember>) {
    setFamilyMembers((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function addMember() {
    setFamilyMembers((list) => [
      ...list,
      { id: newId(), relationship: '', name: null, dob: null, gender: null },
    ])
  }

  function removeMember(id: string) {
    setFamilyMembers((list) => list.filter((m) => m.id !== id))
  }

  function updateFact(id: string, patch: Partial<VoiceFact>) {
    setFacts((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function addFact() {
    setFacts((list) => [...list, { id: newId(), label: '', value: '' }])
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
          family_members: familyMembers.map((m) => ({
            id:           m.id,
            relationship: m.relationship ?? '',
            name:         m.name ?? null,
            dob:          m.dob ?? null,
            gender:       m.gender ?? null,
          })),
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

      {/* ── Family members ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black mb-1">Family</h2>
            <p className="text-xs text-prose-faint">
              People Claude can reference in your reviews. Dates of birth stay stable; ages
              recompute on every draft. Add yourself, a spouse, kids, stepkids — whoever
              shows up in your writing.
            </p>
          </div>
          <button
            onClick={addMember}
            type="button"
            className="shrink-0 text-xs px-3 py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors"
          >
            + Add family member
          </button>
        </div>

        {familyMembers.length === 0 && (
          <p className="text-sm text-prose-faint italic">
            No family members yet. Click <strong>+ Add family member</strong> to start.
          </p>
        )}

        <div className="space-y-3">
          {familyMembers.map((m) => (
            <FamilyMemberRow
              key={m.id}
              member={m}
              onChange={(patch) => updateMember(m.id, patch)}
              onRemove={() => removeMember(m.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Core text fields ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black mb-1">About you</h2>
          <p className="text-xs text-prose-faint">
            Claude pulls from these to add credibility where it fits — current roles, real-world
            experience, beliefs, and where you live. Leave any blank to exclude.
          </p>
        </div>

        <TextAreaField
          label="Background / experience"
          placeholder="Current roles + prior real-world experience. Lead with what you do now, then list the trades, jobs, and ventures Claude can reference where credibly relevant."
          value={occupation}
          onChange={setOccupation}
          rows={6}
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
            <p className="text-xs text-prose-faint">
              Anything else Claude should treat as ground truth — testing philosophy, gear you already
              own, products you refuse to endorse, recurring references. Add freely, remove anytime.
            </p>
          </div>
          <button
            onClick={addFact}
            type="button"
            className="shrink-0 text-xs px-3 py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors"
          >
            + Add fact
          </button>
        </div>

        {facts.length === 0 && (
          <p className="text-sm text-prose-faint italic">
            No additional facts yet. Click <strong>+ Add fact</strong> to start.
          </p>
        )}

        <div className="space-y-3">
          {facts.map((f) => (
            <div key={f.id} className="bg-surface border border-soft rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-3">
                <input
                  type="text"
                  value={f.label}
                  onChange={(e) => updateFact(f.id, { label: e.target.value })}
                  placeholder="Short label (optional) — e.g. Testing approach"
                  className="flex-1 px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
                />
                <button
                  type="button"
                  onClick={() => removeFact(f.id)}
                  className="text-xs px-2 py-2 text-red-600 hover:text-red-700 transition-colors"
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
                className="w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-y"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Save bar ─────────────────────────────────────────────────── */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-surface-sunken/80 backdrop-blur px-4 py-3 rounded-xl border border-soft">
        <div className="min-w-0 text-sm">
          {error && <span className="text-red-600">{error}</span>}
          {!error && savedAt && <span className="text-green-700">✓ Saved at {savedAt}</span>}
          {!error && !savedAt && <span className="text-prose-faint">Changes apply to new drafts immediately after saving.</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : 'Save voice profile'}
        </button>
      </div>
    </div>
  )
}

const RELATIONSHIP_SUGGESTIONS = [
  'Self', 'Wife', 'Husband', 'Partner', 'Fiancée', 'Fiancé',
  'Son', 'Daughter', 'Stepson', 'Stepdaughter',
  'Fiancée\'s son', 'Fiancée\'s daughter', "Fiancé's son", "Fiancé's daughter",
  'Father', 'Mother', 'Brother', 'Sister',
]

function FamilyMemberRow({
  member,
  onChange,
  onRemove,
}: {
  member: FamilyMember
  onChange: (patch: Partial<FamilyMember>) => void
  onRemove: () => void
}) {
  const age = ageFromDob(member.dob)
  return (
    <div className="bg-surface border border-soft rounded-xl p-3 space-y-3">
      <div className="flex items-start gap-3">
        <input
          type="text"
          value={member.relationship}
          onChange={(e) => onChange({ relationship: e.target.value })}
          placeholder="Relationship — e.g. Wife, Stepson, Fiancée's son"
          list="relationship-suggestions"
          className="flex-1 px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-xs px-2 py-2 text-red-600 hover:text-red-700 transition-colors"
          title="Remove family member"
        >
          ✕
        </button>
      </div>

      <input
        type="text"
        value={member.name ?? ''}
        onChange={(e) => onChange({ name: e.target.value || null })}
        placeholder="First name (optional) — helpful if you have more than one of the same role"
        className="w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-prose-faint mb-1">Date of birth</label>
          <input
            type="date"
            value={member.dob ?? ''}
            onChange={(e) => onChange({ dob: e.target.value || null })}
            className="w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          <p className="mt-1 text-xs text-prose-faint">{age ? `Currently ${age}` : '—'}</p>
        </div>
        <div>
          <label className="block text-xs text-prose-faint mb-1">Gender (optional)</label>
          <select
            value={member.gender ?? ''}
            onChange={(e) => onChange({ gender: (e.target.value || null) as Gender | null })}
            className="w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <datalist id="relationship-suggestions">
        {RELATIONSHIP_SUGGESTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
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
      <label className="block text-sm text-prose-muted mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
      />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 2 }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <label className="block text-sm text-prose-muted mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-y"
      />
    </div>
  )
}
