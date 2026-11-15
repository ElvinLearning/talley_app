import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Sheet from './Sheet'
import { Alert, Field } from './ui'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { STATUS, STATUS_ORDER } from '../lib/statuses'

const toForm = (item) => ({
  name: item?.name || '',
  status: item?.status || 'not_started',
  owner: item?.owner || '',
  due_date: item?.due_date ? item.due_date.slice(0, 10) : '',
  cost: item?.cost ? String(item.cost) : '',
  notes: item?.notes || '',
})

/** Add a task to a section, or open an existing one to edit everything about it. */
export default function TaskDialog({ item, group, groupName, team = [], onClose, onSaved }) {
  const editing = !!item
  const [form, setForm] = useState(() => toForm(item))
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const owners = team.some((member) => member.name === form.owner) || !form.owner ? team : [...team, { id: 'current', name: form.owner }]

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      status: form.status,
      owner: form.owner,
      due_date: form.due_date || null,
      cost: Number(form.cost) || 0,
      notes: form.notes,
    }
    try {
      if (editing) await api.updateItem(item.id, payload)
      else await api.addItem(group.id, payload)
      await onSaved()
      onClose()
    } catch (caught) {
      setError(caught.message || 'Could not save this task')
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.deleteItem(item.id)
      await onSaved()
      onClose()
    } catch (caught) {
      setError(caught.message || 'Could not delete this task')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={editing ? 'Task' : 'New task'}
      subtitle={groupName || group?.name}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="submit" form="task-form" disabled={saving || !form.name.trim()} className="btn-primary flex-1">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}
          </button>
          {editing ? (
            <button type="button" onClick={remove} disabled={saving} className={`btn-ghost shrink-0 text-danger ${confirming ? 'border-danger bg-danger-tint' : ''}`}>
              <Trash2 size={16} aria-hidden="true" />
              {confirming ? 'Tap again to delete' : 'Delete'}
            </button>
          ) : null}
        </div>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4">
        <Field label="Task" required maxLength={300} placeholder="e.g. Measure kitchen" data-autofocus value={form.name} onChange={set('name')} />

        <div role="group" aria-labelledby="task-status-label">
          <span id="task-status-label" className="label">
            Status
          </span>
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
                  className="min-h-[40px] rounded-full px-3.5 text-sm font-semibold transition md:min-h-[34px]"
                  style={{ backgroundColor: meta.bg, color: meta.fg, boxShadow: active ? `inset 0 0 0 2px ${meta.fg}` : 'none', opacity: active ? 1 : 0.75 }}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <select className="field" value={form.owner} onChange={set('owner')}>
              <option value="">Unassigned</option>
              {owners.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" type="date" value={form.due_date} onChange={set('due_date')} />
        </div>

        <Field label="Field notes" hint="Shown to the crew member who owns this task.">
          <textarea rows={3} maxLength={5000} placeholder="What the crew needs to know" className="field resize-none" value={form.notes} onChange={set('notes')} />
        </Field>

        <Field
          label="Committed cost ($)"
          hint="Internal. Never shown to field crew."
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0"
          className="max-w-[220px]"
          value={form.cost}
          onChange={set('cost')}
        />

        {editing ? <p className="text-xs text-steel">Last updated {timeAgo(item.updated_at) || 'just now'}</p> : null}
        <Alert message={error} />
      </form>
    </Sheet>
  )
}
