import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Sheet from './Sheet'
import { api } from '../lib/api'
import { STATUS, STATUS_ORDER } from '../lib/statuses'
import { timeAgo } from '../lib/format'

const toForm = (item) => ({
  name: item.name || '',
  status: item.status || 'not_started',
  owner: item.owner || '',
  due_date: item.due_date ? item.due_date.slice(0, 10) : '',
  cost: item.cost ?? 0,
  notes: item.notes || '',
})

export default function ItemSheet({ item, groupName, team = [], onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(() => toForm(item))
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.updateItem(item.id, {
        name: form.name.trim(),
        status: form.status,
        owner: form.owner,
        due_date: form.due_date || null,
        cost: Number(form.cost) || 0,
        notes: form.notes,
      })
      onSaved(updated)
      onClose()
    } catch (caught) {
      setError(caught.message || 'Could not save this task')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.deleteItem(item.id)
      onDeleted()
      onClose()
    } catch (caught) {
      setError(caught.message || 'Could not delete this task')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={form.name || 'Task'}
      subtitle={[groupName, form.owner || 'Unassigned'].filter(Boolean).join(' · ')}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={saving || !form.name.trim()} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className={`btn-ghost shrink-0 px-3.5 text-[#8C2C1B] ${
              confirming ? 'border-[#8C2C1B] bg-[#F6DAD5]' : ''
            }`}
          >
            <Trash2 size={15} />
            <span className="text-xs font-semibold">{confirming ? 'Confirm' : 'Delete'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        <div>
          <label className="label" htmlFor="item-name">
            Task
          </label>
          <input id="item-name" className="field" value={form.name} onChange={set('name')} />
        </div>

        <div>
          <span className="label">Status</span>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((key) => {
              const active = form.status === key
              const meta = STATUS[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, status: key }))}
                  aria-pressed={active}
                  className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition"
                  style={{
                    backgroundColor: meta.bg,
                    color: meta.fg,
                    boxShadow: active ? `inset 0 0 0 2px ${meta.fg}` : 'none',
                  }}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="item-owner">
              Owner
            </label>
            <select id="item-owner" className="field appearance-none" value={form.owner} onChange={set('owner')}>
              <option value="">Unassigned</option>
              {team.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="item-due">
              Due date
            </label>
            <input id="item-due" type="date" className="field" value={form.due_date} onChange={set('due_date')} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="item-cost">
            Committed cost
          </label>
          <input
            id="item-cost"
            type="number"
            inputMode="numeric"
            min="0"
            step="100"
            className="field tabular-nums"
            value={form.cost}
            onChange={set('cost')}
          />
        </div>

        <div>
          <label className="label" htmlFor="item-notes">
            Field notes
          </label>
          <textarea
            id="item-notes"
            rows={3}
            placeholder="What the crew needs to know…"
            className="field resize-none"
            value={form.notes}
            onChange={set('notes')}
          />
        </div>

        <p className="text-[11px] text-steel/80">Last updated {timeAgo(item.updated_at) || 'just now'}</p>
        {error ? <p className="rounded-lg bg-[#F6DAD5] px-3 py-2 text-xs text-[#8C2C1B]">{error}</p> : null}
      </div>
    </Sheet>
  )
}
