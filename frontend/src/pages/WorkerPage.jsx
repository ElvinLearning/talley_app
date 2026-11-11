import { useEffect, useState } from 'react'
import { request } from '../lib/api'
import { send, Alert, Field } from './JobsPage'
import { STATUS, STATUS_ORDER } from '../lib/statuses'

function Task({ task, boardId, user, reload }) {
  const [status,setStatus]=useState(task.status)
  const [notes,setNotes]=useState(task.notes)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const mine=task.owner===user.name
  return <form className="card p-4 space-y-3" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage('')
    try{await send('/work/'+boardId+'/tasks/'+task.id,'PATCH',{status,notes});setMessage('Update saved.');reload()}
    catch(e){setMessage(e.message)}finally{setBusy(false)}
  }}>
    <p className="eyebrow text-maroon">{task.section}</p><h3 className="font-semibold">{task.name}</h3><p className="text-sm text-steel">{task.owner||'Unassigned'} · {task.due_date?'Due '+task.due_date:'No due date'}</p>
    <Field label="Task status"><select className="field" disabled={!mine||busy} value={status} onChange={e=>setStatus(e.target.value)}>{STATUS_ORDER.map(s=><option key={s} value={s}>{STATUS[s].label}</option>)}</select></Field>
    <Field label="Field notes"><textarea className="field" disabled={!mine||busy} value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></Field>
    {mine&&<button className="btn-primary w-full" disabled={busy}>{busy?'Saving…':'Save field update'}</button>}
    {message&&<p role="status" className="text-sm">{message}</p>}
  </form>
}
export default function WorkerPage({ user }) {
  const [boards,setBoards]=useState([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  async function load(){try{setBoards(await request('/work'));setError('')}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  return <div className="workspace space-y-5"><div><p className="eyebrow text-maroon">Field workspace</p><h1 className="font-serif text-3xl">My assigned jobs</h1><p className="text-steel mt-2">Open your work. Update the status. Keep the team informed.</p></div>
    <Alert message={error}/>{error&&<button className="btn-ghost" onClick={load}>Retry</button>}
    {loading?<p>Loading assigned work…</p>:!boards.length?<p className="card p-6">No jobs assigned yet. Ask your administrator to assign a project.</p>:boards.map(b=><section key={b.id}>
      <div className="rounded-2xl bg-maroon text-white p-5 mb-4"><h2 className="font-serif text-2xl">{b.name}</h2><p className="mt-2">{b.address}</p><p className="text-sm mt-3 whitespace-pre-wrap">{b.scope}</p></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{b.tasks.map(t=><Task key={t.id} task={t} boardId={b.id} user={user} reload={load}/>)}</div>
      {!b.tasks.length&&<p className="card p-5">No tasks scheduled yet.</p>}
    </section>)}
  </div>
}
