import { cloneElement, useEffect, useState } from 'react'
import { Plus, ArrowLeft, ArrowRight, FileText, Search, CheckCircle2 } from 'lucide-react'
import { request } from '../lib/api'
import Sheet from '../components/Sheet'
import EstimateEditor from './EstimateEditor'

export const send = (path, method, data) => request(path, { method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
export const dollars = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
export function Field({ label, children, ...props }) {
  return <label className="block min-w-0"><span className="label">{label}</span>{children ? cloneElement(children, {'aria-label':label}) : <input className="field" aria-label={label} {...props} />}</label>
}
export function Alert({ message }) { return message ? <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">{message}</p> : null }

function NewJob({ customers, onClose, onCreated }) {
  const [customer, setCustomer] = useState({ name: '', contact: '', email: '', phone: '' })
  const [customerId, setCustomerId] = useState('')
  const [job, setJob] = useState({ name: '', address: '', scope: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedCustomer, setSavedCustomer] = useState(null)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const id = customerId || savedCustomer || (await send('/customers', 'POST', customer)).id
      setSavedCustomer(id)
      const created = await send('/jobs', 'POST', { ...job, customer_id: Number(id) })
      onCreated(created)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Sheet title="New customer & job" subtitle="Start with the customer, site and scope." onClose={onClose}
    footer={<button className="btn-primary w-full" form="new-job" disabled={busy}>{busy ? 'Creating…' : 'Create job'}</button>}>
    <form id="new-job" onSubmit={submit} className="space-y-4">
      <Field label="Customer"><select className="field" value={customerId} disabled={!!savedCustomer} onChange={e => setCustomerId(e.target.value)}>
        <option value="">Create a new customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></Field>
      {!customerId && <fieldset disabled={!!savedCustomer} className="grid gap-3 sm:grid-cols-2">
        {['name', 'contact', 'email', 'phone'].map(k => <Field key={k} label={{name:'Customer name',contact:'Contact person',email:'Email',phone:'Phone'}[k]}
          type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'} required={['name','contact'].includes(k)} value={customer[k]}
          onChange={e => setCustomer({ ...customer, [k]: e.target.value })} />)}
      </fieldset>}
      <Field label="Job name" required value={job.name} onChange={e => setJob({ ...job, name: e.target.value })} />
      <Field label="Site address" required value={job.address} onChange={e => setJob({ ...job, address: e.target.value })} />
      <Field label="Scope of work"><textarea className="field" required rows={4} value={job.scope} onChange={e => setJob({ ...job, scope: e.target.value })} /></Field>
      <Alert message={error} />
    </form>
  </Sheet>
}

function JobDetail({ job, refresh, onBack, onOpenBoard }) {
  const [estimate, setEstimate] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function run(fn) { setBusy(true); setError(''); try { await fn() } catch(e) { setError(e.message) } finally { setBusy(false) } }
  if (estimate) return <EstimateEditor key={estimate.id} initial={estimate} onBack={() => { setEstimate(null); refresh() }} onConverted={onOpenBoard} />
  return <div className="space-y-6">
    <button className="btn-ghost" onClick={onBack}><ArrowLeft size={16} /> All jobs</button>
    <div className="flex flex-wrap justify-between gap-4">
      <div><p className="eyebrow text-maroon">{job.customer.name} · Job #{job.id}</p><h1 className="text-3xl font-serif mt-1">{job.name}</h1><p className="text-steel mt-2">{job.address}</p></div>
      <span className="status-label self-start">{job.status.replace('_',' ')}</span>
    </div>
    <Alert message={error} />
    <div className="grid lg:grid-cols-3 gap-5">
      <section className="card p-5 lg:col-span-2"><h2 className="section-title">Scope of work</h2><p className="mt-3 whitespace-pre-wrap">{job.scope}</p>
        <div className="mt-5 border-t pt-4"><p className="label">Next action</p><p className="font-semibold">{job.next_action}</p></div>
      </section>
      <section className="card p-5"><h2 className="section-title">Customer contact</h2><p className="mt-3 font-semibold">{job.customer.contact}</p>
        <p className="break-words">{job.customer.email || 'No email provided'}</p><p>{job.customer.phone || 'No phone provided'}</p>
        <Field label="Update job status"><select className="field mt-3" value={job.status} disabled={busy} onChange={e => run(async () => { await send('/jobs/'+job.id+'/status','PATCH',{status:e.target.value}); await refresh() })}>
          {['lead','estimating','approved','active','on_hold','complete'].map(s => <option key={s} value={s} disabled={s==='approved'||(s==='active'&&!job.project)}>{s.replace('_',' ')}</option>)}
        </select></Field>
      </section>
    </div>
    {job.project && <section className="card p-5 flex flex-wrap gap-5 justify-between items-center">
      <div><p className="label">Approved project baseline</p><p>Cost budget <strong>{dollars(job.project.budget_cents)}</strong> · Contract <strong>{dollars(job.project.contract_cents)}</strong></p>
        <p className="text-sm text-steel mt-1">Later revisions do not change this baseline automatically.</p></div>
      <button className="btn-primary" onClick={() => onOpenBoard(job.project.board_id)}>Open project & tasks <ArrowRight size={16} /></button>
    </section>}
    <section className="card p-5">
      <div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="section-title">Estimates & revisions</h2>
        <button className="btn-primary" disabled={busy} onClick={() => run(async () => setEstimate(await send('/jobs/'+job.id+'/estimates','POST')))}>
          <Plus size={16} />{job.estimates.some(e => e.state === 'draft') ? 'Continue draft' : job.estimates.length ? 'Create revision' : 'Build estimate'}
        </button>
      </div>
      {!job.estimates.length && <div className="py-10 text-center text-steel"><FileText className="mx-auto mb-3" /><p>No estimates yet. Add your scope and pricing to begin.</p></div>}
      <div className="mt-4 divide-y">{job.estimates.map(e => <button key={e.id} className="w-full text-left flex items-center gap-4 py-4 hover:bg-sand rounded-lg" disabled={busy}
        onClick={() => run(async () => setEstimate(await request('/estimates/'+e.id)))}>
        <FileText size={22} className="text-maroon" /><span className="flex-1"><strong>Revision {e.revision}</strong><span className="block text-sm text-steel">{e.approved_by ? 'Approval recorded for '+e.approved_by : 'Draft · editable'}</span></span>
        <span className="status-label">{e.state}</span><ArrowRight size={16} />
      </button>)}</div>
    </section>
  </div>
}

export default function JobsPage({ onOpenBoard }) {
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  async function load() {
    try { const [j,c] = await Promise.all([request('/jobs'),request('/customers')]); setJobs(j); setCustomers(c); setError('') }
    catch(e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const active = jobs.find(j => j.id === activeId)
  const visible = jobs.filter(j => (j.name+' '+j.address+' '+j.customer.name).toLowerCase().includes(query.toLowerCase()))
  return <div className="workspace">
    {active ? <JobDetail job={active} refresh={load} onBack={() => setActiveId(null)} onOpenBoard={onOpenBoard} /> : <>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-maroon">A E Talley Construction</p><h1 className="text-3xl sm:text-4xl font-serif mt-1">Every job. One clear next step.</h1><p className="text-steel mt-2">From first conversation to the work on site.</p></div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> New job</button></div>
      <div className="grid grid-cols-3 gap-3 my-6">{[['Open jobs',jobs.filter(j=>j.status!=='complete').length],['Estimating',jobs.filter(j=>j.status==='estimating').length],['Active projects',jobs.filter(j=>j.status==='active').length]].map(([label,n]) =>
        <div className="card p-4 sm:p-5" key={label}><p className="text-sm text-steel">{label}</p><p className="font-serif text-3xl mt-2">{n}</p></div>)}</div>
      <div className="flex gap-2 items-center mb-4"><Search size={18} className="text-steel" /><input aria-label="Search jobs" className="field max-w-md" placeholder="Search job, customer or address" value={query} onChange={e=>setQuery(e.target.value)} /></div>
      <Alert message={error} />{error && <button className="btn-ghost mt-2" onClick={load}>Retry</button>}
      {loading ? <p role="status" className="p-8">Loading jobs…</p> : <div className="card overflow-hidden">
        <div className="job-row hidden md:grid bg-paper text-steel text-xs uppercase tracking-wider"><span>Job / customer</span><span>Status</span><span>Next action</span><span /></div>
        {visible.map(j => <button key={j.id} className="job-row w-full text-left border-t hover:bg-sand" onClick={() => setActiveId(j.id)}>
          <span><strong className="block">{j.name}</strong><span className="text-sm text-steel">{j.customer.name} · {j.address}</span></span>
          <span><span className="status-label">{j.status.replace('_',' ')}</span></span><span className="text-sm">{j.next_action}</span><ArrowRight size={17} className="hidden md:block" />
        </button>)}
        {!visible.length && <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-maroon mb-3" /><h2 className="section-title">{jobs.length ? 'No matching jobs' : 'Your next job starts here'}</h2><p className="text-steel mt-2">{jobs.length ? 'Try another search.' : 'Create a customer and job, then build the estimate.'}</p></div>}
      </div>}
    </>}
    {creating && <NewJob customers={customers} onClose={() => setCreating(false)} onCreated={async j => { await load(); setCreating(false); setActiveId(j.id) }} />}
  </div>
}
