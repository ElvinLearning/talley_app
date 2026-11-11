import { useEffect, useState } from 'react'
import { request } from '../lib/api'
import { send, Alert, dollars } from '../pages/JobsPage'

export default function ProjectAccess({ boardId }) {
  const [workers,setWorkers]=useState([])
  const [selected,setSelected]=useState([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [saved,setSaved]=useState(false)
  const [job,setJob]=useState(null)
  useEffect(()=>{Promise.all([request('/workers'),request('/boards/'+boardId+'/assignments'),request('/jobs')]).then(([w,s,j])=>{
    setWorkers(w);setSelected(s);setJob(j.find(x=>x.project?.board_id===boardId))
  }).catch(e=>setError(e.message))},[boardId])
  return <section className="card p-4 mx-4 mt-4 space-y-3">
    {job&&<><h2 className="section-title">Approved scope & budget</h2><p className="whitespace-pre-wrap">{job.project.scope}</p><p className="text-sm">Cost budget: <strong>{dollars(job.project.budget_cents)}</strong> · Contact: {job.customer.contact} {job.customer.phone}</p></>}
    <h2 className="section-title">Field access</h2><p className="text-sm text-steel">Select who can open this job, then assign individual tasks below. Workers only edit tasks they own.</p>
    <div className="flex flex-wrap gap-3">{workers.map(w=><label key={w.id} className="flex gap-2 items-center min-h-11"><input type="checkbox" checked={selected.includes(w.id)} disabled={busy} onChange={e=>{setSaved(false);setSelected(e.target.checked?[...selected,w.id]:selected.filter(id=>id!==w.id))}}/>{w.name}</label>)}</div>
    <button className="btn-ghost" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await send('/boards/'+boardId+'/assignments','PUT',{user_ids:selected});setSaved(true)}catch(e){setError(e.message)}finally{setBusy(false)}}}>{busy?'Saving…':'Save field access'}</button>
    {saved&&<p role="status" className="text-sm text-green-800">Field access saved.</p>}<Alert message={error}/>
  </section>
}
