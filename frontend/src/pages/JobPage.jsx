import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText, Lock, Mail, MapPin, Phone, Plus } from 'lucide-react'
import ActivityList from '../components/ActivityList'
import Avatar from '../components/Avatar'
import FieldAccess from '../components/FieldAccess'
import ProjectTasks from '../components/ProjectTasks'
import StageSelect from '../components/StageSelect'
import { Alert, BackLink, LoadError, Loading, Tag } from '../components/ui'
import { api, request, send } from '../lib/api'
import { dollars, dueInfo, savedAt, stampDate } from '../lib/format'
import { href, navigate } from '../lib/router'

/** The one thing to do next on this job, with the button that does it. */
function NextStep({ job, busy, onBuild, onConvert, onOpenTask, onAddTask, onStatus }) {
  const step = job.next
  const due = step.kind === 'task' ? dueInfo(step.due_date) : null
  const resume = job.project ? 'active' : job.estimates.length ? 'estimating' : 'lead'
  const action = {
    start: { label: 'Build estimate', run: onBuild },
    estimate: { label: 'Continue estimate', run: () => navigate(`/jobs/${job.id}/estimates/${step.estimate_id}`) },
    convert: { label: 'Create project', run: onConvert },
    plan: { label: 'Add task', run: onAddTask },
    task: { label: 'Open task', run: () => onOpenTask(step.task_id) },
    hold: { label: 'Resume job', run: () => onStatus(resume) },
    complete: { label: 'Reopen job', run: () => onStatus(resume), quiet: true },
  }[step.kind]

  return (
    <section aria-labelledby="next-title" className="card flex flex-wrap items-center gap-x-6 gap-y-3 border-l-4 border-maroon p-4 sm:p-5">
      <div className="min-w-0 flex-1 basis-64">
        <p id="next-title" className="eyebrow text-maroon">
          Next step
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug">
          {step.blocked ? <Tag tone="danger">Blocked</Tag> : null}
          {step.label.replace(/^Unblock: /, '')}
        </p>
        {step.kind === 'task' ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-steel">
            {step.owner ? (
              <span className="inline-flex items-center gap-1.5 text-ink">
                <Avatar name={step.owner} size={22} />
                {step.owner}
              </span>
            ) : (
              <Tag tone="warn">No owner yet</Tag>
            )}
            <span aria-hidden="true">·</span>
            {due ? <span className={due.tone === 'late' ? 'font-semibold text-danger' : ''}>Due {due.label}</span> : <span>No due date</span>}
          </p>
        ) : step.kind === 'plan' ? (
          <p className="mt-1 text-sm text-steel">Every task is done. Add what’s left, or mark the job complete.</p>
        ) : step.kind === 'convert' ? (
          <p className="mt-1 text-sm text-steel">Carries the customer, site, scope and budget into a project with tasks.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {step.kind === 'plan' ? (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => onStatus('complete')}>
            Mark complete
          </button>
        ) : null}
        <button type="button" className={action.quiet ? 'btn-ghost' : 'btn-primary'} disabled={busy} onClick={action.run}>
          {action.label}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

function Estimates({ job, busy, onBuild }) {
  const draft = job.estimates.some((estimate) => estimate.state === 'draft')
  return (
    <section aria-labelledby="estimates-title" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <h2 id="estimates-title" className="section-title">
          Estimates
        </h2>
        <button type="button" className={job.estimates.length ? 'btn-ghost' : 'btn-primary'} disabled={busy} onClick={onBuild}>
          <Plus size={16} aria-hidden="true" />
          {draft ? 'Continue draft' : job.estimates.length ? 'Create revision' : 'Build estimate'}
        </button>
      </div>
      {!job.estimates.length ? (
        <p className="border-t border-line px-4 py-6 text-sm text-steel">No estimate yet. Build one from the scope: sections, then labor, material and subcontractor lines.</p>
      ) : (
        <ul>
          {job.estimates.map((estimate) => {
            const baseline = job.project?.estimate_id === estimate.id
            return (
              <li key={estimate.id} className="border-t border-line">
                <a href={href(`/jobs/${job.id}/estimates/${estimate.id}`)} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                  {estimate.state === 'approved' ? <Lock size={18} className="shrink-0 text-steel" aria-hidden="true" /> : <FileText size={18} className="shrink-0 text-maroon" aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      Revision {estimate.revision}
                      {estimate.state === 'approved' ? <Tag tone="ok">Approved</Tag> : <Tag tone="warn">Draft</Tag>}
                      {baseline ? <Tag tone="brand">Project baseline</Tag> : null}
                    </span>
                    <span className="block truncate text-[13px] text-steel">
                      {estimate.state === 'approved'
                        ? `Approval recorded for ${estimate.approved_by} · ${stampDate(estimate.approved_at)}`
                        : `Editable · last saved ${savedAt(estimate.saved_at)}`}
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-semibold">{dollars(estimate.total_cents)}</span>
                  <ArrowRight size={16} className="shrink-0 text-steel-light" aria-hidden="true" />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Customer({ customer }) {
  return (
    <section aria-labelledby="customer-title" className="card p-4" style={{ gridArea: 'customer' }}>
      <h2 id="customer-title" className="section-title">
        Customer
      </h2>
      <p className="mt-2 font-semibold">{customer.contact}</p>
      {customer.contact !== customer.name ? <p className="text-sm text-steel">{customer.name}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {customer.phone ? (
          <a className="btn-ghost min-w-0" href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}>
            <Phone size={15} aria-hidden="true" />
            <span className="truncate">{customer.phone}</span>
          </a>
        ) : null}
        {customer.email ? (
          <a className="btn-ghost min-w-0" href={`mailto:${customer.email}`}>
            <Mail size={15} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{customer.email}</span>
          </a>
        ) : null}
        {!customer.phone && !customer.email ? <p className="text-sm text-steel">No phone or email on file.</p> : null}
      </div>
    </section>
  )
}

function Baseline({ job, board }) {
  const revision = job.estimates.find((estimate) => estimate.id === job.project.estimate_id)?.revision
  const committed = Math.round((Number(board?.committed) || 0) * 100)
  const left = job.project.budget_cents - committed
  const rows = [
    ['Contract total', dollars(job.project.contract_cents), 'What the customer approved'],
    ['Cost budget', dollars(job.project.budget_cents), 'Your cost before markup — internal'],
  ]
  return (
    <section aria-labelledby="baseline-title" className="card p-4">
      <h2 id="baseline-title" className="section-title">
        Approved budget
      </h2>
      <p className="mt-1 text-[13px] text-steel">
        From revision {revision ?? '—'}. Later revisions don’t change this automatically.
      </p>
      <dl className="mt-3 space-y-2.5">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm">
              {label}
              <span className="block text-xs text-steel">{note}</span>
            </dt>
            <dd className="tabular font-semibold">{value}</dd>
          </div>
        ))}
        {committed ? (
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
            <dt className="text-sm">
              Committed on tasks
              <span className={`block text-xs ${left < 0 ? 'font-semibold text-danger' : 'text-steel'}`}>
                {left < 0 ? `${dollars(-left)} over the cost budget` : `${dollars(left)} of the cost budget left`}
              </span>
            </dt>
            <dd className="tabular font-semibold">{dollars(committed)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

export default function JobPage({ jobId }) {
  const [job, setJob] = useState(null)
  const [board, setBoard] = useState(null)
  const [team, setTeam] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)
  const [openTask, setOpenTask] = useState(null)
  const [addTaskSignal, setAddTaskSignal] = useState(0)
  const teamLoaded = useRef(false)

  const load = useCallback(async () => {
    try {
      const next = await request(`/jobs/${jobId}`)
      if (next.project) {
        const [detail, members] = await Promise.all([api.board(next.project.board_id), teamLoaded.current ? null : api.team()])
        setBoard(detail)
        if (members) {
          teamLoaded.current = true
          setTeam(members)
        }
      }
      setJob(next)
      setError('')
    } catch (caught) {
      setError(caught.message)
    }
  }, [jobId])

  useEffect(() => {
    load()
  }, [load])

  async function run(action) {
    setBusy(true)
    setNotice('')
    setFlash('')
    try {
      await action()
    } catch (caught) {
      setNotice(caught.message)
    } finally {
      setBusy(false)
    }
  }

  const build = () =>
    run(async () => {
      const estimate = await send(`/jobs/${jobId}/estimates`, 'POST')
      navigate(`/jobs/${jobId}/estimates/${estimate.id}`)
    })
  const convert = () =>
    run(async () => {
      const result = await send(`/estimates/${job.next.estimate_id}/convert`, 'POST')
      await load()
      setFlash(result.created ? 'Project created. Add tasks and choose who on the crew can open this job.' : 'This job already has a project — opened it.')
    })
  const setStatus = (status) =>
    run(async () => {
      await send(`/jobs/${jobId}/status`, 'PATCH', { status })
      await load()
    })

  if (error && !job) {
    return (
      <div className="workspace">
        <LoadError message={error} onRetry={load}>
          <a className="btn-ghost" href={href('/jobs')}>
            Back to jobs
          </a>
        </LoadError>
      </div>
    )
  }
  if (!job) {
    return (
      <div className="workspace">
        <Loading label="Opening job…" />
      </div>
    )
  }

  const scope = job.project?.scope ?? job.scope
  const owners = board ? board.groups.flatMap((group) => group.items.filter((item) => item.status !== 'done' && item.owner).map((item) => item.owner)) : []

  return (
    <div className="workspace">
      <BackLink to="/jobs">All jobs</BackLink>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow text-maroon">
            {job.customer.name} · Job #{job.id}
          </p>
          <h1 className="page-title mt-1 break-words">{job.name}</h1>
          <p className="mt-1.5 flex items-start gap-1.5 text-steel">
            <MapPin size={16} className="mt-[3px] shrink-0" aria-hidden="true" />
            {job.address}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-steel">Stage</span>
          <StageSelect job={job} onChanged={() => load()} onError={setNotice} />
        </div>
      </header>

      <div className="mt-5 space-y-3">
        <Alert message={error || notice}>
          {error ? (
            <button type="button" className="btn-ghost" onClick={load}>
              Try again
            </button>
          ) : null}
        </Alert>
        <Alert tone="ok" message={flash} />
        <NextStep
          job={job}
          busy={busy}
          onBuild={build}
          onConvert={convert}
          onOpenTask={setOpenTask}
          onAddTask={() => setAddTaskSignal((value) => value + 1)}
          onStatus={setStatus}
        />
      </div>

      <div className="job-grid mt-5">
        <Customer customer={job.customer} />

        <div className="min-w-0 space-y-5" style={{ gridArea: 'main' }}>
          {board ? <ProjectTasks board={board} team={team} reload={load} openTask={openTask} onOpenTask={setOpenTask} addSignal={addTaskSignal} /> : null}
          <Estimates job={job} busy={busy} onBuild={build} />
          {board ? <ActivityList entries={board.activity} /> : null}
        </div>

        <div className="min-w-0 space-y-5" style={{ gridArea: 'side' }}>
          <section aria-labelledby="scope-title" className="card p-4">
            <h2 id="scope-title" className="section-title">
              {job.project ? 'Approved scope' : 'Scope of work'}
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{scope}</p>
          </section>
          {job.project ? <Baseline job={job} board={board} /> : null}
          {job.project ? <FieldAccess boardId={job.project.board_id} owners={owners} /> : null}
        </div>
      </div>
    </div>
  )
}
