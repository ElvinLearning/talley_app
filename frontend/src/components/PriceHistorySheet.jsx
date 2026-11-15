import { useEffect, useMemo, useState } from 'react'
import { Check, History, Plus, Search } from 'lucide-react'
import Sheet from './Sheet'
import { Alert, EmptyState, Loading, Tag } from './ui'
import { request } from '../lib/api'
import { KINDS } from '../lib/estimateMath'
import { stampDay } from '../lib/format'

const kindLabel = (kind) => KINDS.find((entry) => entry.value === kind)?.label || kind
const rate = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)

/**
 * Reuse a line from estimates this company has already saved.
 * These are Anthony's own numbers — the most recent unit cost entered for each
 * item. Nothing here is generated or suggested by software.
 */
export default function PriceHistorySheet({ estimateId, sectionName, onAdd, onClose }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState([])

  useEffect(() => {
    request(`/price-history?exclude=${estimateId}`)
      .then(setEntries)
      .catch((caught) => setError(caught.message))
  }, [estimateId])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return (entries || []).filter((entry) => !term || `${entry.description} ${entry.kind} ${entry.unit} ${entry.job_name}`.toLowerCase().includes(term))
  }, [entries, query])

  return (
    <Sheet
      title="Add from past estimates"
      subtitle={`Your own saved prices. Adds a line to “${sectionName}”.`}
      onClose={onClose}
      footer={
        <button type="button" className="btn-primary w-full" onClick={onClose}>
          {added.length ? `Done — ${added.length} line${added.length === 1 ? '' : 's'} added` : 'Done'}
        </button>
      }
    >
      <label className="relative block">
        <span className="sr-only">Search past lines</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" aria-hidden="true" />
        <input type="search" data-autofocus className="field pl-9" placeholder="Search tile, electrical, demo…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="mt-3">
        <Alert message={error} />
      </div>
      {!entries && !error ? <Loading label="Loading your saved prices…" /> : null}
      {entries && !entries.length ? (
        <EmptyState icon={History} title="No saved prices yet">
          As you save estimates, each priced line shows up here so you can reuse it on the next job.
        </EmptyState>
      ) : null}
      {entries?.length && !visible.length ? <p className="py-8 text-center text-sm text-steel">Nothing matches “{query.trim()}”.</p> : null}
      <ul className="mt-1 divide-y divide-line">
        {visible.map((entry) => {
          const key = `${entry.description}|${entry.kind}|${entry.unit}`
          const done = added.includes(key)
          return (
            <li key={key}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-1 py-3 text-left hover:bg-paper"
                onClick={() => {
                  onAdd(entry)
                  setAdded((current) => [...current, key])
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{entry.description}</span>
                    <Tag>{kindLabel(entry.kind)}</Tag>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-steel">
                    Last on {entry.job_name} · Rev {entry.revision}
                    {entry.state === 'approved' ? ', approved' : ', draft'} · {stampDay(entry.used_at)}
                    {entry.jobs > 1 ? ` · used on ${entry.jobs} jobs` : ''}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right">
                  <span className="block font-semibold">{rate(entry.unit_cost)}</span>
                  <span className="block text-[13px] text-steel">per {entry.unit}</span>
                </span>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-ok-tint text-ok' : 'bg-maroon-tint text-maroon'}`}>
                  {done ? <Check size={17} aria-label="Added" /> : <Plus size={17} aria-label="Add" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
