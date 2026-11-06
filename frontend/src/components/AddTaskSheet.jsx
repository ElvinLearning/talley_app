import { useState } from 'react'
import Sheet from './Sheet'
import { api } from '../lib/api'
import { STATUS, STATUS_ORDER } from '../lib/statuses'

export default function AddTaskSheet({ group, team = [], onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    status: 'not_started',
    owner: '',
    due_date: '',
    cost: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.addItem(group.id, {
        name: form.name.trim(),
        status: form.status,
        owner: form.owner,
        due_date: form.due_date || null,
        cost: Number(form.cost) || 0,
      })
      onCreated()
      onClose()
    } catch (caught) {
      setError(caught.message || 'Could not add this task')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="New task"
      subtitle={group.name}
      onClose={onClose}
      footer={
        <button type="submit" form="add-task-form" disabled={saving || !form.name.trim()} className="btn-primary w-full">
          {saving ? 'Adding…' : 'Add task'}
        </button>
      }
    >
      <form id="add-task-form" onSubmit={submit} className="space-y-4 pb-1">
        <div>
          <label className="label" htmlFor="new-task-name">
            Task
          </label>
          <input
            id="new-task-name"
            className="field"
            placeholder="e.g. Framing inspection — Level 2"
            value={form.name}
            onChange={set('name')}
            autoFocus
          />
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
            <label className="label" htmlFor="new-task-owner">
              Owner
            </label>
            <select id="new-task-owner" className="field" value={form.owner} onChange={set('owner')}>
              <option value="">Unassigned</option>
              {team.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-task-due">
              Due date
            </label>
            <input id="new-task-due" type="date" className="field" value={form.due_date} onChange={set('due_date')} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="new-task-cost">
            Committed cost
          </label>
          <input
            id="new-task-cost"
            type="number"
            inputMode="numeric"
            min="0"
            step="100"
            placeholder="0"
            className="field tabular-nums"
            value={form.cost}
            onChange={set('cost')}
          />
        </div>

        {error ? <p className="rounded-lg bg-[#F6DAD5] px-3 py-2 text-xs text-[#8C2C1B]">{error}</p> : null}
      </form>
    </Sheet>
  )
}
