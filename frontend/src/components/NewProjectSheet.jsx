import { useState } from 'react'
import Sheet from './Sheet'
import { Alert, Field } from './ui'
import { api } from '../lib/api'

/** A project board with no customer, estimate or approved budget behind it. */
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
      await onCreated(board)
      onClose()
    } catch (caught) {
      setError(caught.message || 'Could not create this board')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Board without an estimate"
      subtitle="For work that will not go through an estimate. Starts with one open section."
      onClose={onClose}
      footer={
        <button type="submit" form="new-project-form" disabled={saving || !form.name.trim()} className="btn-primary w-full">
          {saving ? 'Creating…' : 'Create board'}
        </button>
      }
    >
      <form id="new-project-form" onSubmit={submit} className="space-y-4">
        <Field label="Board name" required data-autofocus placeholder="e.g. Shop and warranty work" value={form.name} onChange={set('name')} />
        <Field label="Client" placeholder="Leave blank for internal work" value={form.client} onChange={set('client')} />
        <Field label="Job address" placeholder="Street, city, state" value={form.address} onChange={set('address')} />
        <Field label="Contract value ($)" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" className="max-w-[220px]" value={form.contract_value} onChange={set('contract_value')} />
        <Alert message={error} />
      </form>
    </Sheet>
  )
}
