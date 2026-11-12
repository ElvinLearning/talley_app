import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { Alert, Field } from './ui'
import { request, send } from '../lib/api'

const CUSTOMER_FIELDS = [
  { key: 'name', label: 'Customer name', required: true, autoComplete: 'organization' },
  { key: 'contact', label: 'Contact person', required: true, autoComplete: 'name' },
  { key: 'email', label: 'Email', type: 'email', inputMode: 'email', autoComplete: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
]

/** Intake: who the customer is, where the work is and what they asked for. */
export default function NewJobSheet({ onClose, onCreated }) {
  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState({ name: '', contact: '', email: '', phone: '' })
  const [customerId, setCustomerId] = useState('')
  const [job, setJob] = useState({ name: '', address: '', scope: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // If the customer saved but the job did not, retrying must not create the customer twice.
  const [savedCustomer, setSavedCustomer] = useState(null)

  useEffect(() => {
    request('/customers')
      .then(setCustomers)
      .catch(() => {}) // Picking an existing customer is optional; a new one can still be entered.
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const id = customerId || savedCustomer || (await send('/customers', 'POST', customer)).id
      setSavedCustomer(id)
      onCreated(await send('/jobs', 'POST', { ...job, customer_id: Number(id) }))
    } catch (caught) {
      setError(caught.message)
      setBusy(false)
    }
  }

  const chosen = customers.find((entry) => String(entry.id) === customerId)

  return (
    <Sheet
      title="New job"
      subtitle="Customer, site and what they asked for."
      onClose={onClose}
      footer={
        <button className="btn-primary w-full" form="new-job" disabled={busy}>
          {busy ? 'Creating…' : 'Create job'}
        </button>
      }
    >
      <form id="new-job" onSubmit={submit} className="space-y-4">
        {customers.length ? (
          <Field label="Customer">
            <select className="field" value={customerId} disabled={!!savedCustomer} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">New customer</option>
              {customers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} — {entry.contact}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {chosen ? (
          <p className="rounded-lg bg-paper px-3 py-2.5 text-sm text-steel ring-1 ring-line">
            {chosen.contact}
            {chosen.phone ? ` · ${chosen.phone}` : ''}
            {chosen.email ? ` · ${chosen.email}` : ''}
          </p>
        ) : (
          <fieldset disabled={!!savedCustomer} className="grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">New customer</legend>
            {CUSTOMER_FIELDS.map(({ key, label, ...props }) => (
              <Field key={key} label={label} {...props} value={customer[key]} onChange={(event) => setCustomer({ ...customer, [key]: event.target.value })} />
            ))}
          </fieldset>
        )}
        <Field label="Job name" required maxLength={200} placeholder="e.g. Fifth Street kitchen" value={job.name} onChange={(event) => setJob({ ...job, name: event.target.value })} />
        <Field label="Site address" required maxLength={500} autoComplete="street-address" value={job.address} onChange={(event) => setJob({ ...job, address: event.target.value })} />
        <Field label="Scope of work" hint="What the customer asked for, in your words. You can refine it on the estimate.">
          <textarea className="field" required rows={4} maxLength={10000} value={job.scope} onChange={(event) => setJob({ ...job, scope: event.target.value })} />
        </Field>
        <Alert message={error} />
      </form>
    </Sheet>
  )
}
