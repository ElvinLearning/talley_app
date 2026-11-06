import { useEffect, useState } from 'react'
import Logo from '../components/Logo'
import StatusPill from '../components/StatusPill'
import { api } from '../lib/api'
import { dueLabel, isOverdue, money } from '../lib/format'
import { STATUS, STATUS_ORDER } from '../lib/statuses'

function Metric({ label, value, hint, tone = 'default' }) {
  return (
    <div className="card p-3.5">
      <p className="text-[9.5px] uppercase tracking-[0.14em] text-steel">{label}</p>
      <p
        className={`mt-1 font-serif text-[21px] leading-none ${
          tone === 'danger' ? 'text-[#8C2C1B]' : tone === 'brand' ? 'text-maroon' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10.5px] text-steel">{hint}</p> : null}
    </div>
  )
}

export default function OverviewPage({ onOpenBoard }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .overview()
      .then(setData)
      .catch((caught) => setError(caught.message || 'Could not load the portfolio'))
  }, [])

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 bg-sand px-8 text-center">
        <p className="font-serif text-lg text-ink">Portfolio did not load</p>
        <p className="text-xs text-steel">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-full bg-sand px-4 pt-6">
        <div className="h-24 animate-pulse rounded-2xl bg-black/[0.06]" />
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-20 animate-pulse rounded-2xl bg-black/[0.05]" />
          ))}
        </div>
      </div>
    )
  }

  const counts = data.by_status || {}
  const totalTasks = STATUS_ORDER.reduce((sum, key) => sum + (Number(counts[key]) || 0), 0)
  const blocked = Number(counts.blocked) || 0
  const open = totalTasks - (Number(counts.done) || 0)

  return (
    <div className="min-h-full bg-sand">
      <header className="sticky top-0 z-30 bg-sand/95 px-4 pb-3 pt-4 backdrop-blur">
        <Logo size={28} wordmark={false} />
        <h1 className="mt-3 font-serif text-[25px] leading-none text-ink">Overview</h1>
        <p className="mt-1.5 text-[11.5px] text-steel">Every job on one screen</p>
      </header>

      <div className="px-4 pb-8">
        <div className="rounded-2xl bg-maroon p-4 text-white shadow-lift">
          <p className="text-[9.5px] uppercase tracking-[0.16em] text-white/55">Portfolio under contract</p>
          <p className="mt-1 font-serif text-[28px] leading-none">{money(data.contract_value)}</p>
          <div className="mt-3 flex items-center justify-between text-[11px] text-white/70">
            <span>{data.boards.length} active projects</span>
            <span>{money(data.committed)} committed</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Metric label="Open tasks" value={open} hint={`${totalTasks} total on the boards`} tone="brand" />
          <Metric label="Blocked" value={blocked} hint={blocked ? 'Needs a call today' : 'Nothing stuck'} tone="danger" />
          <Metric
            label="Contract value"
            value={money(data.contract_value)}
            hint={`${money(data.committed)} committed to subs`}
          />
          <Metric
            label="Budget left"
            value={money(Math.max(0, Number(data.contract_value) - Number(data.committed)))}
            hint="Contract less committed"
          />
        </div>

        <section className="mt-5">
          <h2 className="eyebrow mb-2 text-steel">Workflow</h2>
          <div className="card divide-y divide-black/[0.05]">
            {STATUS_ORDER.map((key) => {
              const count = Number(counts[key]) || 0
              const percent = totalTasks ? (count / totalTasks) * 100 : 0
              return (
                <div key={key} className="flex items-center gap-3 px-3.5 py-2.5">
                  <StatusPill status={key} className="w-[88px] justify-center" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${percent}%`, backgroundColor: STATUS[key].fg, opacity: 0.75 }}
                    />
                  </div>
                  <span className="w-6 text-right text-[12px] font-semibold tabular-nums text-ink">{count}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="eyebrow mb-2 text-steel">Due in the next 10 days</h2>
          <div className="space-y-2">
            {data.due_soon.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenBoard(entry.board_id)}
                className="card flex w-full items-center gap-3 p-3 text-left active:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-ink">{entry.name}</p>
                  <p className="truncate text-[10.5px] text-steel">
                    {entry.board_name} · {entry.owner || 'Unassigned'}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-semibold ${
                    isOverdue(entry.due_date, entry.status) ? 'text-[#B42318]' : 'text-steel'
                  }`}
                >
                  {dueLabel(entry.due_date, entry.status)}
                </span>
              </button>
            ))}
            {!data.due_soon.length ? (
              <p className="card px-4 py-6 text-center text-[11.5px] text-steel">
                Nothing due in the next ten days.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
