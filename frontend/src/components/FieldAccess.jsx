import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Alert } from './ui'
import { request, send } from '../lib/api'

/**
 * Who on the crew can open this job on their phone. A change saves straight
 * away. Crew see scope and tasks only — the server never sends them prices.
 */
export default function FieldAccess({ boardId, owners = [] }) {
  const [workers, setWorkers] = useState(null)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([request('/workers'), request(`/boards/${boardId}/assignments`)])
      .then(([people, ids]) => {
        if (!live) return
        setWorkers(people)
        setSelected(ids)
      })
      .catch((caught) => live && setError(caught.message))
    return () => {
      live = false
    }
  }, [boardId])

  async function save(next) {
    const before = selected
    setSelected(next)
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await send(`/boards/${boardId}/assignments`, 'PUT', { user_ids: next })
      setSaved(true)
    } catch (caught) {
      setSelected(before)
      setError(caught.message)
    } finally {
      setBusy(false)
    }
  }

  const locked = (workers || []).filter((worker) => owners.includes(worker.name) && !selected.includes(worker.id))

  return (
    <section aria-labelledby="access-title" className="card p-4">
      <h2 id="access-title" className="section-title">
        Crew access
      </h2>
      <p className="mt-1 text-[13px] text-steel">Who can open this job on their phone. They see the scope and tasks, never prices.</p>
      {workers === null && !error ? <p className="mt-3 text-sm text-steel">Loading crew…</p> : null}
      {workers?.length === 0 ? <p className="mt-3 text-sm text-steel">No field crew accounts yet.</p> : null}
      <div className="mt-2">
        {(workers || []).map((worker) => (
          <label key={worker.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-paper">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] accent-[#6D2431]"
              checked={selected.includes(worker.id)}
              disabled={busy}
              onChange={(event) => save(event.target.checked ? [...selected, worker.id] : selected.filter((id) => id !== worker.id))}
            />
            <span className="text-sm">{worker.name}</span>
          </label>
        ))}
      </div>
      {locked.map((worker) => (
        <div key={worker.id} className="mt-2 rounded-lg border border-warn/30 bg-warn-tint px-3 py-2.5 text-[13px] text-warn">
          <p className="font-medium">{worker.name} owns a task here but can’t open this job yet.</p>
          <button type="button" className="link mt-1 !text-warn" disabled={busy} onClick={() => save([...selected, worker.id])}>
            Give access
          </button>
        </div>
      ))}
      <p role="status" className="mt-2 flex min-h-[20px] items-center gap-1.5 text-[13px] font-medium text-ok">
        {saved ? (
          <>
            <Check size={15} aria-hidden="true" />
            Crew access saved.
          </>
        ) : null}
      </p>
      <Alert message={error} />
    </section>
  )
}
