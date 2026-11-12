import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, ClipboardList, Plus, RefreshCw, Sunrise } from 'lucide-react'
import NewJobSheet from '../components/NewJobSheet'
import { Alert, EmptyState, LoadError, Loading, StageChip } from '../components/ui'
import { request } from '../lib/api'
import { briefJobs } from '../lib/briefing'
import { href, navigate } from '../lib/router'
import { timeAgo } from '../lib/format'

export default function TodayPage() {
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updated, setUpdated] = useState(null)
  async function load() {
    setBusy(true)
    try { setJobs(await request('/jobs')); setError(''); setUpdated(new Date()) }
    catch (caught) { setError(caught.message) }
    finally { setBusy(false) }
  }
  useEffect(() => { load() }, [])
  if (!jobs) return <div className="workspace">{error ? <LoadError message={error} onRetry={load} /> : <Loading label="Preparing your day…" />}</div>
  const brief = briefJobs(jobs)
  return <div className="workspace fade-in">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div><p className="eyebrow text-steel">Your workspace</p><h1 className="page-title mt-1">Today</h1></div>
      <div className="flex gap-2"><button className="btn-ghost" disabled={busy} onClick={load} aria-label="Refresh briefing"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /></button><button className="btn-primary" onClick={() => setCreating(true)}><Plus size={17} />New job</button></div>
    </div>
    <Alert message={error} />
    <section className="day-banner mt-3" aria-labelledby="day-title">
      <div className="relative z-10 max-w-xl">
        <p className="eyebrow flex items-center gap-2 text-white/80"><Sunrise size={17} />{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h2 id="day-title" className="font-serif text-2xl sm:text-[38px] leading-tight mt-4">Good work starts<br />with a clear next step.</h2>
        <p className="mt-4 text-sm sm:text-base text-white/85 max-w-md">{brief.priorities.length ? `${brief.priorities.length} job${brief.priorities.length === 1 ? '' : 's'} to review. Clear the blockers, move the estimates forward, and keep your crew moving.` : 'A clear view of your jobs, your crew, and what comes next.'}</p>
        <a href={href('/jobs')} className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-white underline underline-offset-4">Open the job sheet <ArrowRight size={16} /></a>
      </div>
      <div className="blueprint" aria-hidden="true"><span /><span /><span /></div>
    </section>
    <div className="grid grid-cols-3 gap-2 sm:gap-4 my-5" aria-label="Workspace summary">
      {[[brief.active, 'Active jobs'], [brief.drafts, 'Jobs with drafts'], [brief.ready, 'Ready to start']].map(([value, label]) => <div className="card p-3 sm:p-5" key={label}><p className="tabular font-serif text-3xl text-maroon">{value}</p><p className="text-xs sm:text-sm text-steel mt-1">{label}</p></div>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <section className="card overflow-hidden" aria-labelledby="focus-title">
        <div className="p-5 border-b border-line flex items-center justify-between gap-3"><div><p className="eyebrow text-maroon">Your next moves</p><h2 id="focus-title" className="section-title mt-1">Needs your attention</h2></div><span className="chip bg-sand">{brief.priorities.length}</span></div>
        {brief.priorities.length ? <ul className="divide-y divide-line">{brief.priorities.map(({ job, reason }, index) => <li key={job.id}><a className="focus-row" href={href(`/jobs/${job.id}`)}><span className="focus-number">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><p className={`eyebrow ${reason === 'Ready to start' ? 'text-ok' : 'text-maroon'}`}>{reason}</p><h3 className="font-semibold mt-1 break-words">{job.name}</h3><p className="text-sm text-steel mt-1 break-words">{job.next_action}</p></div><ArrowRight size={18} className="shrink-0 text-maroon" /></a></li>)}</ul> : <EmptyState icon={CheckCircle2} title="Nothing urgent here">No blocked, overdue, unassigned or due-today work, and no projects waiting to start.</EmptyState>}
      </section>
      <div className="space-y-5">
        <section className="card p-5" aria-labelledby="recent-title"><h2 id="recent-title" className="section-title">Pick up where you left off</h2>{brief.recent.length ? <ul className="mt-3 divide-y divide-line">{brief.recent.map(job => <li key={job.id}><a href={href(`/jobs/${job.id}`)} className="block py-3 rounded-lg hover:bg-paper"><div className="flex justify-between items-start gap-2"><p className="font-semibold text-sm break-words min-w-0">{job.name}</p><ArrowRight size={15} className="shrink-0 mt-1 text-steel" /></div><div className="flex flex-wrap gap-2 items-center mt-2"><StageChip stage={job.status} /><span className="text-xs text-steel">{timeAgo(job.updated_at)}</span></div></a></li>)}</ul> : <EmptyState icon={ClipboardList} title="Start with your first job">Add the customer, site and scope to get started.</EmptyState>}</section>
        <a className="card block p-5 hover:bg-paper transition" href={href('/assistant')}><p className="eyebrow text-maroon">Built on your experience</p><h2 className="font-serif text-2xl mt-2">Your past work.<br />A better starting point.</h2><p className="text-sm text-steel mt-3">Find prices from saved estimates, with the original job and revision alongside every result.</p><span className="inline-flex gap-2 items-center text-sm font-semibold text-maroon mt-4">Explore past prices <ArrowRight size={16} /></span></a>
      </div>
    </div>
    <p className="mt-5 text-xs text-steel" role="status">Updated {updated?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Based on saved job records</p>
    {creating ? <NewJobSheet onClose={() => setCreating(false)} onCreated={job => { setCreating(false); navigate(`/jobs/${job.id}`) }} /> : null}
  </div>
}
