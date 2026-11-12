import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Search, ShieldCheck, Unplug } from 'lucide-react'
import { Alert, EmptyState, Loading, Tag } from '../components/ui'
import { request } from '../lib/api'
import { stampDate } from '../lib/format'

export default function AssistantPage() {
  const [query, setQuery] = useState('')
  const [approved, setApproved] = useState(true)
  const [data, setData] = useState(null)
  const [connections, setConnections] = useState(null)
  const [error, setError] = useState('')
  const [connectionError, setConnectionError] = useState('')
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  async function search(event) {
    event?.preventDefault()
    const current = ++sequence.current
    setBusy(true); setError(''); setData(null)
    try {
      const result = await request(`/assistant/evidence?q=${encodeURIComponent(query)}&approved_only=${approved}`)
      if (current === sequence.current) setData(result)
    } catch (caught) { if (current === sequence.current) setError(caught.message) }
    finally { if (current === sequence.current) setBusy(false) }
  }
  async function loadConnections() {
    setConnectionError('')
    try { setConnections(await request('/integrations')) }
    catch (caught) { setConnectionError(caught.message) }
  }
  useEffect(() => { search(); loadConnections(); return () => { sequence.current++ } }, [])
  return <div className="workspace fade-in">
    <p className="eyebrow text-maroon">The knowledge in your work</p>
    <h1 className="page-title mt-2">Estimate library</h1>
    <p className="text-steel mt-2 max-w-2xl">A trusted starting point for your next estimate. Find what you priced before and open the original record before reusing it.</p>
    <div className="flex flex-wrap items-center gap-2 mt-4"><Tag tone="ok">Saved records only</Tag><span className="text-xs text-steel">AI generation is not connected</span></div>
    <section className="card mt-6 overflow-hidden" aria-label="Historical price search">
      <form className="bg-paper p-4 sm:p-5 border-b border-line" onSubmit={search}>
        <label htmlFor="evidence-search" className="label">Search descriptions, sections or jobs</label>
        <div className="flex gap-2"><input id="evidence-search" type="search" maxLength={200} className="field" placeholder="Try tile, electrical, or kitchen…" value={query} onChange={event => setQuery(event.target.value)} /><button className="btn-primary shrink-0" disabled={busy}><Search size={16} /><span>Search</span></button></div>
        <label className="inline-flex items-center gap-2 mt-4 text-sm cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-[#6D2431]" checked={approved} onChange={event => setApproved(event.target.checked)} />Approved estimates only</label>
        <p className="mt-2 text-xs text-steel">Search applies your filters. These are estimated unit costs, not actual job costs or current supplier quotes.</p>
      </form>
      {error ? <div className="p-5"><Alert message={error}><button className="btn-ghost" onClick={() => search()}>Try again</button></Alert></div> : null}
      {busy ? <div className="px-5"><Loading label="Finding saved prices…" /></div> : data ? <>
        <div className="px-5 py-3 text-xs text-steel border-b border-line" role="status">{data.total_matches} matching price{data.total_matches === 1 ? '' : 's'} · Searched {data.searched_estimates} recent estimates (up to {data.search_limit}){data.total_matches > data.results.length ? ` · Showing first ${data.results.length}; narrow your search for more specific results` : ''}</div>
        {data.results.length ? <ul className="grid md:grid-cols-2">{data.results.map(row => <li key={row.source_id} className="p-5 border-b border-line md:odd:border-r min-w-0"><div className="flex justify-between items-start gap-3"><div className="min-w-0"><p className="eyebrow text-steel">{row.kind}</p><h2 className="font-semibold mt-1 break-words">{row.description}</h2></div><Tag tone={row.state === 'approved' ? 'ok' : 'warn'}>{row.state === 'approved' ? 'Approved' : 'Draft'}</Tag></div><p className="mt-4 text-2xl font-serif text-maroon">{Number(row.unit_cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}<span className="font-sans text-sm text-steel"> / {row.unit}</span></p><p className="text-xs text-steel mt-1">Internal unit cost · {stampDate(row.saved_at)}</p><a href={row.href} className="flex items-start gap-2 mt-4 text-sm text-maroon font-semibold underline underline-offset-4"><span className="min-w-0 break-words">{row.job_name} · Revision {row.revision}</span><ArrowUpRight size={16} className="shrink-0" /></a><p className="text-xs text-steel mt-1 break-words">{row.section}</p></li>)}</ul> : <EmptyState icon={BookOpen} title="No matching prices yet">Try fewer words, include draft estimates, or save and approve a priced estimate. Prices will appear here with their sources.</EmptyState>}
      </> : null}
    </section>
    <section className="mt-8" aria-labelledby="connections-title"><div className="flex gap-3 items-start"><ShieldCheck size={23} className="text-maroon shrink-0" /><div><h2 id="connections-title" className="section-title">Connected services</h2><p className="text-sm text-steel mt-1">Your team stays in control of what leaves this workspace.</p></div></div>
      <div className="mt-4"><Alert message={connectionError}><button className="btn-ghost" onClick={loadConnections}>Try again</button></Alert></div>
      <div className="grid gap-3 sm:grid-cols-2 mt-4">{connections?.connections.map(connection => <div className="card p-4" key={connection.id}><div className="flex gap-2 items-center"><Unplug size={16} className="text-steel" /><h3 className="font-semibold text-sm">{connection.name}</h3></div><p className="eyebrow text-steel mt-3">Not connected</p><p className="text-sm text-steel mt-2">{connection.description}</p></div>)}</div>
    </section>
  </div>
}
