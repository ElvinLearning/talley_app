import { useState } from 'react'
import Sheet from './Sheet'
import { api } from '../lib/api'

export default function NewProjectSheet({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', client: '', address: '', contract_value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const board = await api.createBoard({
        name: form.name.trim(),
        client: form.client.trim(),
        address: form.address.trim(),
        contract_value: Number(form.contract_value) || 0,
      })
      onCreated(board)
      onClose()
    } catch (caught) {
      setError(caught.message || 'Could not create this project')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="New project"
      subtitle="Creates a board with one open scope"
      onClose={onClose}
      footer={
        <button
          type="submit"
          form="new-project-form"
          disabled={saving || !form.name.trim()}
          className="btn-primary w-full"
        >
          {saving ? 'Creating…' : 'Create project'}
        </button>
      }
    >
      <form id="new-project-form" onSubmit={submit} className="space-y-4 pb-1">
        <div>
          <label className="label" htmlFor="project-name">
            Project name
          </label>
          <input
            id="project-name"
            className="field"
            placeholder="e.g. Northshore Clinic Buildout"
            value={form.name}
            onChange={set('name')}
            autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor="project-client">
            Owner / client
          </label>
          <input id="project-client" className="field" placeholder="Who we bill" value={form.client} onChange={set('client')} />
        </div>
        <div>
          <label className="label" htmlFor="project-address">
            Job address
          </label>
          <input
            id="project-address"
            className="field"
            placeholder="Street · City, TN"
            value={form.address}
            onChange={set('address')}
          />
        </div>
        <div>
          <label className="label" htmlFor="project-value">
            Contract value
          </label>
          <input
            id="project-value"
            type="number"
            inputMode="numeric"
            min="0"
            step="1000"
            placeholder="0"
            className="field tabular-nums"
            value={form.contract_value}
            onChange={set('contract_value')}
          />
        </div>
        {error ? <p className="rounded-lg bg-[#F6DAD5] px-3 py-2 text-xs text-[#8C2C1B]">{error}</p> : null}
      </form>
    </Sheet>
  )
}
