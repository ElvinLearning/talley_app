// The field crew's view. Deliberately two steps and nothing else:
// my jobs → my tasks on a job → set status, add a note, save.
// Everything shown comes from /api/work, which never includes prices.
import { useCallback, useContext, useEffect, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, HardHat, MapPin } from 'lucide-react'
import StatusPill from '../components/StatusPill'
import { Alert, BackLink, LoadError, Loading, Tag } from '../components/ui'
import { request, send } from '../lib/api'
import { DraftContext } from '../lib/DraftContext'
import { daysFromToday, dueInfo, savedAt } from '../lib/format'
import { href } from '../lib/router'
import { STATUS, STATUS_ORDER } from '../lib/statuses'

const STATUS_HELP = {
  blocked: 'Say what is in the way so the office can clear it.',
  review: 'Ready for someone to check.',
}

function summary(job) {
  const mine = job.tasks.filter((task) => task.mine && task.status !== 'done')
  const blocked = mine.filter((task) => task.status === 'blocked').length
  const dated = mine.filter((task) => task.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))
  return { open: mine.length, blocked, next: dated[0] || null, total: job.tasks.filter((task) => task.mine).length }
}

export function WorkerHome() {
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setJobs(await request('/work'))
      setError('')
    } catch (caught) {
      setError(caught.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="workspace !max-w-2xl">
      <h1 className="page-title">My jobs</h1>
      <p className="mt-1 text-steel">Tap a job to see your tasks.</p>
      {error ? <LoadError message={error} onRetry={load} /> : null}
      {!jobs && !error ? <Loading label="Loading your jobs…" /> : null}
      {jobs && !jobs.length ? (
        <div className="card mt-5 p-8 text-center">
          <HardHat className="mx-auto text-steel-light" size={34} strokeWidth={1.6} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">No jobs yet</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-steel">When the office adds you to a job, it shows up here.</p>
          <button type="button" className="btn-ghost mt-5" onClick={load}>
            Check again
          </button>
        </div>
      ) : null}
      <ul className="mt-5 space-y-3">
        {(jobs || []).map((job) => {
          const info = summary(job)
          const due = info.next ? dueInfo(info.next.due_date) : null
          return (
            <li key={job.id}>
              <a href={href(`/work/${job.id}`)} className="card flex items-center gap-4 p-4 active:bg-paper sm:p-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold leading-snug">{job.name}</span>
                  <span className="mt-1 flex items-start gap-1.5 text-steel">
                    <MapPin size={16} className="mt-[3px] shrink-0" aria-hidden="true" />
                    {job.address}
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-2">
                    {info.open ? (
                      <Tag tone="brand">
                        {info.open} task{info.open === 1 ? '' : 's'} to do
                      </Tag>
                    ) : info.total ? (
                      <Tag tone="ok">All your tasks are done</Tag>
                    ) : (
                      <Tag>No tasks for you yet</Tag>
                    )}
                    {info.blocked ? <Tag tone="danger">{info.blocked} blocked</Tag> : null}
                    {due ? <span className={`text-sm ${due.tone === 'late' ? 'font-semibold text-danger' : 'text-steel'}`}>Next due {due.label}</span> : null}
                  </span>
                </span>
                <ChevronRight size={22} className="shrink-0 text-steel-light" aria-hidden="true" />
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** One of my tasks: pick a status, add a note, save. */
function TaskCard({ task, boardId, onSaved, onDirty }) {
  const [status, setStatus] = useState(task.status)
  const [notes, setNotes] = useState(task.notes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedTime, setSavedTime] = useState(null)
  const changed = status !== task.status || notes !== task.notes
  const due = dueInfo(task.due_date, task.status)

  useEffect(() => {
    onDirty(task.id, changed)
  }, [changed, onDirty, task.id])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await send(`/work/${boardId}/tasks/${task.id}`, 'PATCH', { status, notes })
      setSavedTime(new Date())
      onSaved(saved)
    } catch (caught) {
      setError(`Not saved. ${caught.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card overflow-hidden" aria-label={task.name}>
      <div className="p-4 sm:p-5">
        <p className="eyebrow text-steel">{task.section}</p>
        <h3 className="mt-1 text-lg font-semibold leading-snug">{task.name}</h3>
        <p className={`mt-1 ${due?.tone === 'late' ? 'font-semibold text-danger' : 'text-steel'}`}>{due ? (task.status === 'done' ? `Was due ${due.label}` : `Due ${due.label}`) : 'No due date'}</p>

        <fieldset className="mt-4" disabled={busy}>
          <legend className="label">Where is it at?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATUS_ORDER.map((key) => {
              const active = status === key
              const meta = STATUS[key]
              return (
                <label
                  key={key}
                  className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 text-center text-base font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maroon ${
                    active ? '' : 'border-line bg-white text-ink/80'
                  }`}
                  style={active ? { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.fg } : undefined}
                >
                  <input type="radio" className="sr-only" name={`status-${task.id}`} value={key} checked={active} onChange={() => setStatus(key)} />
                  {active ? <Check size={18} aria-hidden="true" /> : null}
                  {meta.label}
                </label>
              )
            })}
          </div>
          {STATUS_HELP[status] ? <p className="mt-2 text-sm text-steel">{STATUS_HELP[status]}</p> : null}
        </fieldset>

        <label className="mt-4 block">
          <span className="label">Note for the office {status === 'blocked' ? '' : '(optional)'}</span>
          <textarea className="field" rows={3} maxLength={5000} disabled={busy} placeholder={status === 'blocked' ? 'What is in the way?' : 'Anything they should know'} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>

      <div className="border-t border-line bg-paper px-4 py-3 sm:px-5">
        {error ? (
          <p role="alert" className="mb-3 flex items-start gap-2 font-medium text-danger">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        {changed || busy ? (
          <button className="btn-primary !min-h-[52px] w-full !text-base" disabled={busy}>
            {busy ? 'Saving…' : 'Save update'}
          </button>
        ) : (
          <p role="status" className={`flex min-h-[52px] items-center justify-center gap-2 rounded-lg text-base font-semibold ${savedTime ? 'bg-ok-tint text-ok' : 'text-steel'}`}>
            {savedTime ? (
              <>
                <CheckCircle2 size={20} aria-hidden="true" />
                Saved at {savedAt(savedTime)}
              </>
            ) : (
              'Up to date'
            )}
          </p>
        )}
      </div>
    </form>
  )
}

export function WorkerJob({ boardId }) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  const [dirtyTasks, setDirtyTasks] = useState({})
  const reportDirty = useContext(DraftContext)

  const load = useCallback(async () => {
    try {
      setJob(await request(`/work/${boardId}`))
      setError('')
    } catch (caught) {
      setError(caught.message)
    }
  }, [boardId])
  useEffect(() => {
    load()
  }, [load])

  // Warn before leaving with a status or note that has not been saved.
  const onDirty = useCallback((id, value) => setDirtyTasks((current) => (!!current[id] === value ? current : { ...current, [id]: value })), [])
  const anyDirty = Object.values(dirtyTasks).some(Boolean)
  useEffect(() => {
    reportDirty(anyDirty)
    return () => reportDirty(false)
  }, [anyDirty, reportDirty])

  if (error) {
    return (
      <div className="workspace !max-w-2xl">
        <LoadError message={error} onRetry={load}>
          <a className="btn-ghost" href={href('/')}>
            My jobs
          </a>
        </LoadError>
      </div>
    )
  }
  if (!job) {
    return (
      <div className="workspace !max-w-2xl">
        <Loading label="Opening job…" />
      </div>
    )
  }

  const rank = (task) => (task.status === 'done' ? 2 : task.status === 'blocked' ? 0 : 1)
  const mine = job.tasks.filter((task) => task.mine).sort((a, b) => rank(a) - rank(b) || (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.id - b.id)
  const others = job.tasks.filter((task) => !task.mine)
  const late = mine.filter((task) => task.status !== 'done' && task.due_date && daysFromToday(task.due_date) < 0).length
  const saved = (updated) => setJob((current) => ({ ...current, tasks: current.tasks.map((task) => (task.id === updated.id ? { ...task, ...updated } : task)) }))

  return (
    <div className="workspace !max-w-2xl">
      <BackLink to="/">My jobs</BackLink>
      <h1 className="page-title mt-2 break-words">{job.name}</h1>
      <p className="mt-1.5 flex items-start gap-1.5 text-steel">
        <MapPin size={17} className="mt-[3px] shrink-0" aria-hidden="true" />
        {job.address}
      </p>

      {job.scope ? (
        <details className="card mt-4 group" open={mine.length === 0}>
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            What this job is
            <ChevronRight size={18} className="text-steel transition group-open:rotate-90" aria-hidden="true" />
          </summary>
          <p className="whitespace-pre-wrap break-words border-t border-line px-4 py-3 leading-relaxed">{job.scope}</p>
        </details>
      ) : null}

      <h2 className="mt-6 flex flex-wrap items-center gap-2 text-lg font-semibold">
        Your tasks
        {late ? <Tag tone="danger">{late} late</Tag> : null}
      </h2>
      {!mine.length ? <p className="card mt-3 p-5 text-steel">Nothing assigned to you on this job yet. The office will add your tasks here.</p> : null}
      <div className="mt-3 space-y-4">
        {mine.map((task) => (
          <TaskCard key={task.id} task={task} boardId={boardId} onSaved={saved} onDirty={onDirty} />
        ))}
      </div>

      {others.length ? (
        <details className="card mt-6 group">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            Rest of the crew’s tasks ({others.length})
            <ChevronRight size={18} className="text-steel transition group-open:rotate-90" aria-hidden="true" />
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {others.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-medium">{task.name}</span>
                  <span className="block text-sm text-steel">{task.owner || 'Not assigned yet'}</span>
                </span>
                <StatusPill status={task.status} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
