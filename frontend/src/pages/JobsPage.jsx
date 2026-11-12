import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ClipboardList, Plus, Search, X } from 'lucide-react'
import Avatar from '../components/Avatar'
import NewJobSheet from '../components/NewJobSheet'
import StageSelect from '../components/StageSelect'
import { Alert, EmptyState, LoadError, Loading, StageChip, Tag } from '../components/ui'
import { request } from '../lib/api'
import { daysFromToday, dollars, dueInfo } from '../lib/format'
import { href, navigate } from '../lib/router'

const PRE_CONSTRUCTION = ['lead', 'estimating', 'approved']

/** What, if anything, is stuck on this job. */
function attention(job) {
  if (job.status === 'complete' || job.status === 'on_hold') return null
  if (job.tasks?.blocked) return { rank: 0, tone: 'danger', label: job.tasks.blocked === 1 ? 'Blocked' : `${job.tasks.blocked} blocked` }
  const days = job.tasks?.earliest_due ? daysFromToday(job.tasks.earliest_due) : null
  if (days !== null && days < 0) return { rank: 1, tone: 'danger', label: 'Overdue' }
  if (job.next.kind === 'task' && !job.next.owner) return { rank: 2, tone: 'warn', label: 'No owner' }
  return null
}

const VIEWS = [
  { key: 'open', label: 'All open', match: (job) => job.status !== 'complete' },
  { key: 'attention', label: 'Needs attention', match: (job) => !!attention(job) },
  { key: 'pre', label: 'Estimating', match: (job) => PRE_CONSTRUCTION.includes(job.status) },
  { key: 'active', label: 'Active', match: (job) => job.status === 'active' },
  { key: 'hold', label: 'On hold', match: (job) => job.status === 'on_hold' },
  { key: 'complete', label: 'Complete', match: (job) => job.status === 'complete' },
]

const SORTS = {
  priority: 'Priority',
  newest: 'Newest first',
  customer: 'Customer A–Z',
}

function priority(job) {
  if (job.status === 'complete') return 9
  if (job.status === 'on_hold') return 6
  return attention(job)?.rank ?? 3
}

const dueOf = (job) => job.next.due_date || job.tasks?.earliest_due || '9999'

function amount(job) {
  if (job.project) return { cents: job.project.contract_cents, label: 'Contract' }
  const latest = job.estimates[0]
  if (!latest || !latest.total_cents) return null
  return { cents: latest.total_cents, label: latest.state === 'approved' ? 'Approved estimate' : 'Draft estimate' }
}

function progress(job) {
  if (!job.tasks || !job.tasks.total) return ''
  return `${job.tasks.done} of ${job.tasks.total} task${job.tasks.total === 1 ? '' : 's'} done`
}

function Owner({ job }) {
  if (job.next.kind === 'task') {
    return job.next.owner ? (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar name={job.next.owner} size={24} />
        <span className="truncate">{job.next.owner}</span>
      </span>
    ) : (
      <Tag tone="warn">Unassigned</Tag>
    )
  }
  if (job.status === 'complete') return <span className="text-steel">—</span>
  return <span className="text-steel">Office</span>
}

function Due({ job, stacked = false }) {
  const info = job.next.kind === 'task' ? dueInfo(job.next.due_date) : null
  if (!info) return <span className="text-steel">—</span>
  if (info.tone === 'late' && stacked) {
    return (
      <span className="text-danger">
        <span className="block font-semibold">{info.date}</span>
        <span className="block text-[13px]">{info.late}</span>
      </span>
    )
  }
  return <span className={info.tone === 'late' ? 'font-semibold text-danger' : info.tone === 'today' ? 'font-semibold text-ink' : ''}>{info.label}</span>
}

const remembered = (key, fallback) => {
  try {
    return sessionStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const remember = (key, value) => {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* Private browsing: the choice simply is not kept. */
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState(() => remembered('talley.jobs.query', ''))
  const [view, setView] = useState(() => remembered('talley.jobs.view', 'open'))
  const [sort, setSort] = useState(() => remembered('talley.jobs.sort', 'priority'))
  const search = useRef(null)

  async function load() {
    try {
      setJobs(await request('/jobs'))
      setError('')
    } catch (caught) {
      setError(caught.message)
    }
  }
  useEffect(() => {
    load()
  }, [])
  useEffect(() => remember('talley.jobs.query', query), [query])
  useEffect(() => remember('talley.jobs.view', view), [view])
  useEffect(() => remember('talley.jobs.sort', sort), [sort])

  // "/" jumps to search, like most list tools.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return
      event.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((entry) => [entry.key, (jobs || []).filter(entry.match).length])), [jobs])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const active = VIEWS.find((entry) => entry.key === view) || VIEWS[0]
    const rows = (jobs || []).filter(
      (job) =>
        active.match(job) &&
        (!term ||
          [job.name, job.address, job.customer.name, job.customer.contact, job.next.label, job.next.owner || '']
            .join(' ')
            .toLowerCase()
            .includes(term))
    )
    if (sort === 'newest') return rows.sort((a, b) => b.id - a.id)
    if (sort === 'customer') return rows.sort((a, b) => a.customer.name.localeCompare(b.customer.name) || b.id - a.id)
    return rows.sort((a, b) => priority(a) - priority(b) || dueOf(a).localeCompare(dueOf(b)) || b.id - a.id)
  }, [jobs, query, view, sort])

  const replaceJob = (updated) => setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)))
  const filtered = query.trim() || view !== 'open'

  if (error && !jobs) {
    return (
      <div className="workspace">
        <LoadError message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div className="workspace">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="mt-1 text-sm text-steel">
            {jobs
              ? `${counts.open} open${counts.attention ? ` · ${counts.attention} need${counts.attention === 1 ? 's' : ''} attention` : ''}`
              : 'From first call to closeout.'}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={17} aria-hidden="true" />
          New job
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div role="group" aria-label="Filter jobs" className="no-scrollbar -mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {VIEWS.map((entry) => {
            const active = entry.key === view
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={active}
                onClick={() => setView(entry.key)}
                className={`inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition md:min-h-[36px] ${
                  active ? 'bg-ink text-white' : 'bg-white text-ink/80 ring-1 ring-line hover:bg-paper'
                }`}
              >
                {entry.label}
                <span className={`tabular text-xs ${active ? 'text-white/75' : entry.key === 'attention' && counts.attention ? 'font-bold text-danger' : 'text-steel'}`}>
                  {counts[entry.key] ?? '–'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <span className="sr-only">Search jobs</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" aria-hidden="true" />
            <input
              ref={search}
              type="search"
              className="field !py-2 pl-9"
              placeholder="Search job, customer, address"
              aria-keyshortcuts="/"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="shrink-0">
            <span className="sr-only">Sort jobs</span>
            <select className="field !w-auto !py-2" value={sort} onChange={(event) => setSort(event.target.value)}>
              {Object.entries(SORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Alert message={error || notice}>
          {error ? (
            <button type="button" className="btn-ghost" onClick={load}>
              Try again
            </button>
          ) : null}
        </Alert>
      </div>

      {!jobs ? (
        <Loading label="Loading jobs…" />
      ) : !visible.length ? (
        <div className="card mt-2">
          {jobs.length && filtered ? (
            <EmptyState
              icon={Search}
              title="No jobs match"
              action={
                <button type="button" className="btn-ghost" onClick={() => { setQuery(''); setView('open') }}>
                  <X size={16} aria-hidden="true" />
                  Clear search and filters
                </button>
              }
            >
              Nothing fits this filter{query.trim() ? ` and “${query.trim()}”` : ''}.
            </EmptyState>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={jobs.length ? 'No open jobs' : 'No jobs yet'}
              action={
                <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                  <Plus size={17} aria-hidden="true" />
                  New job
                </button>
              }
            >
              {jobs.length ? 'Everything is complete. Start the next one when a customer calls.' : 'Add the customer, the site and what they asked for. The estimate starts from there.'}
            </EmptyState>
          )}
        </div>
      ) : (
        <>
          {/* Desktop and tablet: the sheet. */}
          <div className="card mt-2 hidden overflow-hidden md:block">
            <table className="jobs-table">
              <colgroup>
                <col style={{ width: '27%' }} />
                <col style={{ width: '132px' }} />
                <col />
                <col style={{ width: '17%' }} />
                <col style={{ width: '112px' }} />
                <col style={{ width: '148px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Next step</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Due</th>
                  <th scope="col" className="!text-right">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((job) => {
                  const flag = attention(job)
                  const value = amount(job)
                  return (
                    <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)}>
                      <td>
                        <a href={href(`/jobs/${job.id}`)} onClick={(event) => event.stopPropagation()} className="block truncate font-semibold text-ink hover:text-maroon hover:underline">
                          {job.name}
                        </a>
                        <span className="block truncate text-[13px] text-steel">
                          {job.customer.name} · {job.address}
                        </span>
                      </td>
                      <td>
                        <StageSelect job={job} onChanged={replaceJob} onError={setNotice} />
                      </td>
                      <td>
                        <span className="flex min-w-0 items-center gap-2">
                          {flag ? <Tag tone={flag.tone}>{flag.label}</Tag> : null}
                          <span className="line-clamp-2 min-w-0">{job.next.label.replace(/^Unblock: /, '')}</span>
                        </span>
                        {progress(job) ? <span className="block truncate text-[13px] text-steel">{progress(job)}</span> : null}
                      </td>
                      <td>
                        <Owner job={job} />
                      </td>
                      <td>
                        <Due job={job} stacked />
                      </td>
                      <td className="tabular text-right">
                        {value ? (
                          <>
                            <span className="block font-semibold">{dollars(value.cents)}</span>
                            <span className="block text-[13px] text-steel">{value.label}</span>
                          </>
                        ) : (
                          <span className="text-steel">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per job, same facts. */}
          <ul className="mt-2 space-y-2.5 md:hidden">
            {visible.map((job) => {
              const flag = attention(job)
              return (
                <li key={job.id}>
                  <a href={href(`/jobs/${job.id}`)} className="card block p-4 active:bg-paper">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold leading-snug">{job.name}</span>
                        <span className="mt-0.5 block text-sm text-steel">{job.customer.name}</span>
                      </span>
                      <StageChip stage={job.status} />
                    </span>
                    <span className="mt-3 flex items-center gap-3 border-t border-line pt-3">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          {flag ? <Tag tone={flag.tone}>{flag.label}</Tag> : null}
                          <span className="font-medium">{job.next.label.replace(/^Unblock: /, '')}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-steel">
                          <Owner job={job} />
                          {job.next.kind === 'task' && job.next.due_date ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <Due job={job} />
                            </>
                          ) : null}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-steel-light" aria-hidden="true" />
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-steel" aria-live="polite">
            Showing {visible.length} of {jobs.length} job{jobs.length === 1 ? '' : 's'}
          </p>
        </>
      )}

      {creating ? (
        <NewJobSheet
          onClose={() => setCreating(false)}
          onCreated={(job) => {
            setCreating(false)
            navigate(`/jobs/${job.id}`)
          }}
        />
      ) : null}
    </div>
  )
}
