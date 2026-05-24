'use client'

interface Props {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  accent: string
}

export function ListEditor({ label, items, onChange, placeholder, accent }: Props) {
  function update(index: number, value: string) {
    const next = [...items]
    next[index] = value
    onChange(next)
  }
  function remove(index: number) { onChange(items.filter((_, i) => i !== index)) }
  function add() { onChange([...items, '']) }

  return (
    <div>
      <label className="block text-sm text-prose-muted mb-1.5">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-4 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-3 py-2 text-prose-faint hover:text-red-300 transition-colors text-lg leading-none"
            >×</button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className={`text-xs font-medium ${accent} hover:opacity-80 transition-opacity`}
        >+ Add item</button>
      </div>
    </div>
  )
}
