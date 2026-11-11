import { useContext, useEffect, useState } from 'react'
import { ArrowLeft, Plus, Trash2, Eye, Save } from 'lucide-react'
import { request } from '../lib/api'
import { Field, Alert, send, dollars } from './JobsPage'
import { DraftContext } from '../lib/DraftContext'

const blankLine = () => ({ description:'',kind:'labor',quantity:'1',unit:'hour',unit_cost:'0' })
function editable(document) {
  return { scope:document.job.scope,markup_percent:document.markup_percent,tax_percent:document.tax_percent,tax_basis:document.tax_basis,notes:document.notes,
    sections:document.sections.map(s=>({name:s.name,lines:s.lines.map(l=>Object.fromEntries(['description','kind','quantity','unit','unit_cost'].map(k=>[k,l[k]])))})) }
}
// Match server ROUND_HALF_UP using scaled integers; totals below are provisional until saved.
function scaled(value, places) {
  if (!/^\d+(\.\d*)?$/.test(String(value))) return 0n
  const [whole,part=''] = String(value).split('.')
  return BigInt(whole)*10n**BigInt(places)+BigInt((part+'0'.repeat(places)).slice(0,places))
}
function halfUp(n,d) { return (n+d/2n)/d }
function totals(form) {
  let cost=0n,markup=0n,taxable=0n
  const lines=form.sections.map(s=>s.lines.map(l=>{
    const c=halfUp(scaled(l.quantity,3)*scaled(l.unit_cost,2),1000n)
    const m=halfUp(c*scaled(form.markup_percent,2),10000n)
    cost+=c; markup+=m
    if(form.tax_basis==='all'||(form.tax_basis==='materials'&&l.kind==='material')) taxable+=c+m
    return {cost:Number(c),price:Number(c+m)}
  }))
  const tax=halfUp(taxable*scaled(form.tax_percent,2),10000n)
  return {lines,cost:Number(cost),markup:Number(markup),tax:Number(tax),total:Number(cost+markup+tax)}
}

function Preview({ preview, close }) {
  const d=preview.document
  return <div className="client-preview space-y-5">
    <div className="flex flex-wrap gap-3 no-print"><button className="btn-ghost" onClick={close}><ArrowLeft size={16} /> Back to estimate</button><button className="btn-primary" onClick={()=>window.print()}>Print / save PDF</button></div>
    <article className="card p-6 sm:p-10 max-w-4xl mx-auto">
      <div className="flex flex-wrap justify-between gap-4 border-b pb-6"><div><p className="eyebrow text-maroon">A E Talley Construction LLC</p><h1 className="font-serif text-3xl mt-2">Estimate</h1><p className="text-sm text-steel">#{preview.id} · Revision {preview.revision} · {preview.state}</p></div><p className="text-sm">Prepared for<br/><strong>{d.job.customer.name}</strong><br/>{d.job.customer.contact}</p></div>
      <h2 className="section-title mt-6">{d.job.name}</h2><p>{d.job.address}</p><p className="my-5 whitespace-pre-wrap">{d.job.scope}</p>
      {d.sections.map((s,i)=><section key={i} className="my-6"><h3 className="font-semibold border-b pb-2">{s.name}</h3>
        {s.lines.map((l,j)=><div key={j} className="flex gap-4 justify-between py-3 border-b text-sm"><span>{l.description}<small className="block text-steel">{l.quantity} {l.unit}</small></span><strong>{dollars(l.price_cents)}</strong></div>)}
      </section>)}
      <div className="ml-auto max-w-sm space-y-2">{[['Subtotal','subtotal_cents'],['Tax','tax_cents'],['Total','total_cents']].map(([label,k])=><div key={k} className="flex justify-between gap-3"><span>{label}</span><strong>{dollars(d.totals[k])}</strong></div>)}</div>
      {d.notes && <p className="border-t mt-6 pt-4 whitespace-pre-wrap">{d.notes}</p>}
      {preview.approved_by && <p className="mt-6 text-sm">Approval recorded for {preview.approved_by} on {new Date(preview.approved_at).toLocaleDateString()}.</p>}
      <p className="mt-8 border-t pt-4 text-xs text-steel">Demo estimate · Synthetic pricing for workflow review. Not a customer offer.</p>
    </article>
  </div>
}

export default function EstimateEditor({ initial, onBack, onConverted }) {
  const [estimate,setEstimate]=useState(initial)
  const [form,setForm]=useState(()=>editable(initial.document))
  const [dirty,setDirty]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [preview,setPreview]=useState(null)
  const [approver,setApprover]=useState('')
  const [note,setNote]=useState('')
  const approved=estimate.state==='approved'
  const sum=totals(form)
  const reportDirty=useContext(DraftContext)
  useEffect(()=>{reportDirty(dirty);return()=>reportDirty(false)},[dirty,reportDirty])
  useEffect(()=>{
    const warn=e=>{if(dirty){e.preventDefault();e.returnValue=''}}
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)
  },[dirty])
  function change(next) { setForm(next);setDirty(true);setMessage('') }
  function lineChange(si,li,k,v) { change({...form,sections:form.sections.map((s,i)=>i!==si?s:{...s,lines:s.lines.map((l,j)=>j!==li?l:{...l,[k]:v})})}) }
  async function action(fn) {setBusy(true);setError('');setMessage('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function save() {
    const updated=await send('/estimates/'+estimate.id,'PUT',{...form,version:estimate.version})
    setEstimate(updated);setForm(editable(updated.document));setDirty(false);setMessage('Estimate saved.');return updated
  }
  function leave() { if(!dirty||window.confirm('Leave without saving this estimate?'))onBack() }
  if(preview)return <Preview preview={preview} close={()=>setPreview(null)} />
  return <div className="space-y-5">
    <button className="btn-ghost" onClick={leave}><ArrowLeft size={16}/>Back to job</button>
    <div className="flex flex-wrap justify-between gap-4"><div><p className="eyebrow text-maroon">{estimate.document.job.name}</p><h1 className="font-serif text-3xl">Estimate · Revision {estimate.revision}</h1><p className="text-steel mt-1">{approved?'Approved snapshot · Read only':dirty?'Unsaved changes':'Draft · Saved'}</p></div>
      <div className="flex flex-wrap gap-2 self-start">
        {!approved&&<button form="estimate-form" className="btn-primary" disabled={busy}><Save size={16}/>{busy?'Working…':'Save estimate'}</button>}
        <button className="btn-ghost" disabled={busy||dirty} onClick={()=>action(async()=>setPreview(await request('/estimates/'+estimate.id+'/preview')))}><Eye size={16}/>Client preview</button>
      </div>
    </div>
    <Alert message={error}/>{message&&<p role="status" className="bg-green-50 text-green-900 p-3 rounded-xl">{message}</p>}
    {dirty&&<p className="text-sm text-steel">Save changes before previewing or recording approval.</p>}
    <form id="estimate-form" onSubmit={e=>{e.preventDefault();action(save)}} className="space-y-5">
      <fieldset disabled={approved||busy} className="space-y-5 min-w-0">
        <Field label="Estimated scope"><textarea className="field" required maxLength={10000} rows={3} value={form.scope} onChange={e=>change({...form,scope:e.target.value})}/></Field>
        <section className="card p-5">
          <h2 className="section-title mb-4">Pricing settings</h2><div className="grid sm:grid-cols-3 gap-4">
            <Field label="Markup on cost (%)" type="number" min="0" max="1000" step=".01" required value={form.markup_percent} onChange={e=>change({...form,markup_percent:e.target.value})}/>
            <Field label="Tax rate (%)" type="number" min="0" max="100" step=".01" required value={form.tax_percent} onChange={e=>change({...form,tax_percent:e.target.value})}/>
            <Field label="Tax applies to"><select className="field" value={form.tax_basis} onChange={e=>change({...form,tax_basis:e.target.value})}><option value="none">No tax</option><option value="materials">Materials including markup</option><option value="all">All selling prices</option></select></Field>
          </div><p className="text-sm text-steel mt-3">Provisional rules: line cost, line markup and total tax round half up to cents. Confirm rates and taxable work with Anthony.</p>
        </section>
        {form.sections.map((section,si)=><section className="card p-4 sm:p-5" key={si}>
          <div className="flex gap-3 items-end mb-4"><div className="flex-1"><Field label={'Section '+(si+1)} value={section.name} required maxLength={150} onChange={e=>change({...form,sections:form.sections.map((s,i)=>i===si?{...s,name:e.target.value}:s)})}/></div>
            {form.sections.length>1&&<button type="button" className="btn-ghost" aria-label={'Remove section '+(si+1)} onClick={()=>change({...form,sections:form.sections.filter((_,i)=>i!==si)})}><Trash2 size={16}/></button>}
          </div>
          <div className="space-y-4">{section.lines.map((line,li)=><div key={li} className="estimate-line rounded-xl bg-sand p-3">
            <Field label="Description" value={line.description} required maxLength={500} onChange={e=>lineChange(si,li,'description',e.target.value)}/>
            <Field label="Type"><select className="field" value={line.kind} onChange={e=>lineChange(si,li,'kind',e.target.value)}>{['labor','material','subcontractor'].map(k=><option key={k}>{k}</option>)}</select></Field>
            <Field label="Quantity" type="number" min=".001" max="1000000" step=".001" required value={line.quantity} onChange={e=>lineChange(si,li,'quantity',e.target.value)}/>
            <Field label="Unit" value={line.unit} required maxLength={30} onChange={e=>lineChange(si,li,'unit',e.target.value)}/>
            <Field label="Unit cost ($)" type="number" min="0" max="10000000" step=".01" required value={line.unit_cost} onChange={e=>lineChange(si,li,'unit_cost',e.target.value)}/>
            <div className="flex items-center justify-between gap-2"><div><p className="label">Line cost</p><strong className="text-sm">{dollars(sum.lines[si][li].cost)}</strong><small className="block text-steel">Price {dollars(sum.lines[si][li].price)}</small></div>
              {section.lines.length>1&&<button type="button" aria-label={'Remove line '+(li+1)+' from section '+(si+1)} className="p-3 text-maroon" onClick={()=>change({...form,sections:form.sections.map((s,i)=>i===si?{...s,lines:s.lines.filter((_,j)=>j!==li)}:s)})}><Trash2 size={16}/></button>}
            </div>
          </div>)}</div>
          <button type="button" className="btn-ghost mt-4" onClick={()=>change({...form,sections:form.sections.map((s,i)=>i===si?{...s,lines:[...s.lines,blankLine()]}:s)})}><Plus size={16}/>Add line</button>
        </section>)}
        <button type="button" className="btn-ghost" onClick={()=>change({...form,sections:[...form.sections,{name:'New section',lines:[blankLine()]}]})}><Plus size={16}/>Add section</button>
        <Field label="Client-facing notes"><textarea className="field" rows={3} value={form.notes} onChange={e=>change({...form,notes:e.target.value})}/></Field>
      </fieldset>
    </form>
    <section className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">{[['Internal cost',sum.cost],['Markup',sum.markup],['Tax',sum.tax],['Client total',sum.total]].map(([label,value])=><div key={label}><p className="label">{label}</p><strong className="text-xl">{dollars(value)}</strong></div>)}</section>
    {!approved?<form className="card p-5 space-y-4" onSubmit={e=>{e.preventDefault();action(async()=>{const updated=await send('/estimates/'+estimate.id+'/approve','POST',{version:estimate.version,approved_by:approver,note});setEstimate(updated);setMessage('Approval recorded. This revision is now locked.')})}}>
      <h2 className="section-title">Record customer approval</h2><p className="text-sm text-steel">Record approval received outside this app. This does not send anything or collect an electronic signature.</p>
      <div className="grid sm:grid-cols-2 gap-4"><Field label="Approved by" required value={approver} onChange={e=>setApprover(e.target.value)}/><Field label="Approval evidence / note" required placeholder="e.g. Demo approval recorded during walkthrough" value={note} onChange={e=>setNote(e.target.value)}/></div>
      <button className="btn-primary" disabled={dirty||busy}>Record approval & lock revision</button>
    </form>:<section className="card p-5 space-y-3"><h2 className="section-title">Approved by {estimate.approved_by}</h2><p className="text-sm text-steel">{estimate.approval_note}</p>
      <button className="btn-primary" disabled={busy} onClick={()=>action(async()=>{const result=await send('/estimates/'+estimate.id+'/convert','POST');onConverted(result.board_id)})}>Open / create project from approval</button>
      <p className="text-sm text-steel">Repeated conversion opens the same project. Create a revision from the job to change estimated scope; the project baseline remains unchanged.</p>
    </section>}
  </div>
}
