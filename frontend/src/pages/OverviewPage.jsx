import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import StatusPill from '../components/StatusPill'
import { LoadError, Loading } from '../components/ui'
import { api } from '../lib/api'
import { dueInfo, moneyFull } from '../lib/format'
import { href } from '../lib/router'
import { STATUS, STATUS_ORDER } from '../lib/statuses'

/** Across every project: what is due soon and where the work stands. */
export default function OverviewPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await api.overview())
      setError('')
    } catch (caught) {
      setError(caught.message || 'Could not load the overview')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div className="workspace">
        <LoadError message={error} onRetry={load} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="workspace">
        <Loading label="Loading overview…" />
      </div>
    )
  }

  const counts = data.by_status || {}
  const totalTasks = STATUS_ORDER.reduce((sum, key) => sum + (Number(counts[key]) || 0), 0)
  const open = totalTasks - (Number(counts.done) || 0)
  const jobOf = Object.fromEntries(data.boards.map((board) => [board.id, board.job_id]))
  const facts = [
    [`${data.boards.length}`, `project${data.boards.length === 1 ? '' : 's'}`],
    [moneyFull(data.contract_value), 'under contract'],
    [moneyFull(data.committed), 'committed on tasks'],
    [`${open}`, `open task${open === 1 ? '' : 's'}`],
  ]

  return (
    <div className="workspace">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="tabular mt-1 text-sm text-steel">
            {facts.map(([value, label], index) => (
              <span key={label}>
                {index ? ' · ' : ''}
                <strong className="font-semibold text-ink">{value}</strong> {label}
              </span>
            ))}
          </p>
        </div>
        <a className="btn-ghost" href={href('/projects')}>
          All project boards
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="due-title" className="card overflow-hidden">
          <h2 id="due-title" className="section-title px-4 py-3.5">
            Due in the next 10 days
          </h2>
          {!data.due_soon.length ? <p className="border-t border-line px-4 py-6 text-sm text-steel">Nothing due in the next ten days.</p> : null}
          <ul>
            {data.due_soon.map((entry) => {
              const due = dueInfo(entry.due_date, entry.status)
              const to = jobOf[entry.board_id] ? `/jobs/${jobOf[entry.board_id]}` : `/boards/${entry.board_id}`
              return (
                <li key={entry.id} className="border-t border-line">
                  <a href={href(to)} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.name}</span>
                      <span className="block truncate text-[13px] text-steel">
                        {entry.board_name} · {entry.owner || 'Unassigned'}
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm ${due?.tone === 'late' ? 'font-semibold text-danger' : 'text-steel'}`}>{due?.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="status-title" className="card overflow-hidden">
          <h2 id="status-title" className="section-title px-4 py-3.5">
            Tasks by status
          </h2>
          <ul>
            {STATUS_ORDER.map((key) => {
              const count = Number(counts[key]) || 0
              return (
                <li key={key} className="flex items-center gap-3 border-t border-line px-4 py-3">
                  <StatusPill status={key} className="w-[104px] justify-center" />
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${totalTasks ? (count / totalTasks) * 100 : 0}%`, backgroundColor: STATUS[key].fg, opacity: 0.75 }} />
                  </span>
                  <span className="tabular w-8 text-right text-sm font-semibold">{count}</span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
