import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronUp, Play, RotateCcw, X } from 'lucide-react'
import { Alert, Loading, Tag } from './ui'
import { request } from '../lib/api'
import { href, navigate, usePath } from '../lib/router'
import { makeWalkthroughSteps } from '../lib/walkthrough'

const WalkthroughContext = createContext(null)
const storageKey = (user) => `talley.walkthrough.v1.${user.role}.${user.id}`
const blank = { active: false, stepId: null, viewed: [], finished: false }

function restore(user) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(user)) || 'null')
    return saved && Array.isArray(saved.viewed) ? {
      active: saved.active === true,
      stepId: typeof saved.stepId === 'string' ? saved.stepId : null,
      viewed: saved.viewed.filter(id => typeof id === 'string'),
      finished: saved.finished === true,
    } : { ...blank }
  } catch { return { ...blank } }
}

export function useWalkthrough() {
  const value = useContext(WalkthroughContext)
  if (!value) throw new Error('Walkthrough components must be inside WalkthroughProvider')
  return value
}

export function WalkthroughProvider({ user, children }) {
  const path = usePath()
  const previousPath = useRef(path)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(() => restore(user))
  const sequence = useRef(0)
  const steps = useMemo(() => makeWalkthroughSteps(user, records), [user.role, records])
  const selectedIndex = Math.max(0, steps.findIndex(step => step.id === progress.stepId))

  const retry = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true); setError('')
    try {
      const data = await request(user.role === 'admin' ? '/jobs' : '/work')
      if (current === sequence.current) setRecords(data)
    } catch (caught) { if (current === sequence.current) setError(caught.message) }
    finally { if (current === sequence.current) setLoading(false) }
  }, [user.role, user.id])

  useEffect(() => {
    setRecords([])
    setProgress(restore(user))
    retry()
    return () => { sequence.current++ }
  }, [retry, user.id, user.role])

  useEffect(() => {
    try { sessionStorage.setItem(storageKey(user), JSON.stringify(progress)) } catch { /* Session storage is optional. */ }
  }, [progress, user.id, user.role])

  useEffect(() => {
    if (previousPath.current !== path && path === '/guide') retry()
    previousPath.current = path
  }, [path, retry])

  const start = (index = selectedIndex) => {
    if (loading || !Number.isInteger(index)) return false
    const next = steps[Math.max(0, Math.min(steps.length - 1, index))]
    if (!navigate(next.path)) return false
    setProgress(previous => ({ ...previous, active: true, finished: false, stepId: next.id,
      viewed: [...new Set([...previous.viewed, next.id])] }))
    return true
  }
  const close = () => setProgress(previous => ({ ...previous, active: false }))
  const restart = () => {
    if (loading || !navigate(steps[0].path)) return false
    setProgress({ active: true, stepId: steps[0].id, viewed: [steps[0].id], finished: false })
    return true
  }
  const finish = () => {
    if (!navigate('/guide')) return false
    setProgress(previous => ({ ...previous, active: false, finished: true }))
    return true
  }
  return <WalkthroughContext.Provider value={{ steps, start, close, restart, finish, selectedIndex, loading, error, retry, progress }}>
    {children}
  </WalkthroughContext.Provider>
}

export function WalkthroughPanel() {
  const { steps, start, close, finish, selectedIndex, loading, error, retry, progress } = useWalkthrough()
  const [expanded, setExpanded] = useState(true)
  const path = usePath()
  const step = steps[selectedIndex]
  if (!progress.active) return null
  const away = path !== step.path && !(step.path === '/today' && path === '/')
  return <section className="no-print shrink-0 border-b border-maroon/20 bg-paper px-3 py-2 sm:px-6" aria-label="Guided walkthrough">
    <div className="mx-auto max-w-[1256px]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-40">
          <label className="eyebrow text-maroon" htmlFor="walkthrough-step">Walkthrough · {selectedIndex + 1} of {steps.length}</label>
          <select id="walkthrough-step" className="block max-w-full w-full bg-transparent text-sm font-semibold py-1.5 pr-2 rounded" value={selectedIndex} onChange={event => start(Number(event.target.value))} disabled={loading}>
            {steps.map((entry, index) => <option key={entry.id} value={index}>{index + 1}. {entry.title}</option>)}
          </select>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="btn-quiet !px-2" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="walkthrough-instructions" aria-label={expanded ? 'Hide step instructions' : 'Show step instructions'}>{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}<span className="hidden sm:inline">Instructions</span></button>
          <button className="btn-ghost !px-2 sm:!px-3" onClick={() => start(selectedIndex - 1)} disabled={loading || selectedIndex === 0} aria-label="Previous walkthrough step"><ArrowLeft size={16} /></button>
          <button className="btn-primary !px-3" onClick={() => selectedIndex === steps.length - 1 ? finish() : start(selectedIndex + 1)} disabled={loading}>{selectedIndex === steps.length - 1 ? 'Finish' : 'Next'}<ArrowRight size={15} /></button>
          <button className="btn-quiet !px-2" onClick={close} aria-label="Close walkthrough"><X size={18} /></button>
        </div>
      </div>
      {away ? <div className="flex flex-wrap items-center gap-2 text-xs text-steel"><span>You’re exploring another screen.</span><button className="link min-h-[32px]" onClick={() => start(selectedIndex)} disabled={loading}>Return to this step</button></div> : null}
      {step.missing ? <p className="mt-2 rounded-lg bg-warn-tint p-2 text-xs text-warn">{step.missing}</p> : null}
      {expanded ? <div id="walkthrough-instructions" className="max-h-[28dvh] overflow-y-auto border-t border-line mt-1 pt-3 pb-1 text-sm">
        <p className="font-semibold" role="status">{step.description}</p>
        <ol className="list-decimal pl-5 mt-2 space-y-1 text-steel">{step.actions.map(action => <li key={action}>{action}</li>)}</ol>
        <p className="mt-3 text-xs text-steel">Guide steps open screens; they do not save, approve, send or complete work for you.</p>
      </div> : null}
      {loading ? <p className="text-xs text-steel" role="status">Finding the current example records…</p> : null}
      {error ? <div className="mt-2"><Alert message={error}><button className="btn-ghost" onClick={retry}>Retry guide links</button></Alert></div> : null}
    </div>
  </section>
}

export function WalkthroughPage() {
  const { steps, start, restart, selectedIndex, loading, error, retry, progress } = useWalkthrough()
  const viewed = steps.filter(step => progress.viewed.includes(step.id)).length
  return <div className="workspace fade-in">
    <p className="eyebrow text-maroon">A guided look around</p>
    <h1 className="page-title mt-2">Demo walkthrough</h1>
    <p className="mt-3 max-w-2xl text-steel">Follow the guide through the real screens, or jump to any feature below. You stay in control: the walkthrough never saves changes, approves an estimate or sends an AI message.</p>
    <div className="card mt-6 p-5 sm:p-6 border-l-4 border-maroon">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="min-w-0"><h2 className="section-title">{progress.finished ? 'You reached the end of the guide' : 'Explore at your own pace'}</h2><p className="mt-1 text-sm text-steel">{viewed} of {steps.length} screens introduced · Your place is kept in this browser session.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={loading} onClick={() => start(selectedIndex)}><Play size={16} />{viewed ? 'Resume walkthrough' : 'Start walkthrough'}</button>{viewed ? <button className="btn-ghost" disabled={loading} onClick={restart}><RotateCcw size={16} />Restart</button> : null}</div>
      </div>
      <p className="mt-4 text-xs text-steel">Use sample information in the shared demo. Next and Finish mean you have moved through the guide, not that business tasks are complete. Return here or choose Refresh links after creating or changing example records.</p>
    </div>
    {error ? <div className="mt-4"><Alert message={error}><button className="btn-ghost" onClick={retry}>Retry guide links</button></Alert></div> : null}
    {loading ? <Loading label="Finding the current example records…" /> : null}
    <div className="mt-7 flex items-center justify-between gap-3"><h2 className="section-title">Everything you can explore</h2><button className="btn-quiet" disabled={loading} onClick={retry}><RotateCcw size={14} />Refresh links</button></div>
    <ol className="grid gap-3 mt-4 md:grid-cols-2">
      {steps.map((step, index) => <li className="card p-5 min-w-0" key={step.id}>
        <div className="flex gap-3 items-start"><span className="font-serif text-2xl text-maroon shrink-0">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><p className="eyebrow text-steel">{step.section}</p><h3 className="font-semibold mt-1">{step.title}</h3></div>{progress.viewed.includes(step.id) ? <span className="ml-auto"><Tag>Visited</Tag></span> : null}</div>
        <p className="text-sm text-steel mt-3">{step.description}</p>
        {step.missing ? <p className="text-xs text-warn mt-3">{step.missing}</p> : null}
        <details className="mt-3 text-sm"><summary className="cursor-pointer min-h-[32px] text-maroon font-semibold">What to try</summary><ol className="list-decimal pl-5 mt-2 space-y-2 text-steel">{step.actions.map(action => <li key={action}>{action}</li>)}</ol></details>
        <button className="btn-quiet mt-3 -ml-3" disabled={loading} onClick={() => start(index)} aria-label={`Open walkthrough step ${index + 1}: ${step.title}`}>Open this step<ArrowRight size={16} /></button>
      </li>)}
    </ol>
    <div className="mt-6 flex items-center gap-2 text-xs text-steel"><BookOpen size={15} /><span>You can reopen this guide from Walkthrough at any time.</span></div>
    <a className="link inline-block mt-5" href={href(steps[0].path)}>Back to workspace</a>
  </div>
}
