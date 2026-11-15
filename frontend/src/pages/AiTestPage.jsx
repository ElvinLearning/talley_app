import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, KeyRound, Mic, MicOff, RefreshCw, Send, Sparkles, Trash2, Volume2, XCircle } from 'lucide-react'
import { Alert, Loading, Tag } from '../components/ui'
import { request, send } from '../lib/api'

// Role presets: a first look at "agents with roles". Each is just a system prompt.
const ROLES = [
  { id: 'general', name: 'General assistant', prompt: 'You are a helpful assistant for A E Talley Construction, a small construction company. Answer clearly and briefly.' },
  { id: 'estimator', name: 'Estimator', prompt: 'You are an estimating assistant for a construction company. Help scope jobs: ask clarifying questions, list the work as sections and line items (labor, material, subcontractor) with units. Never present prices as final; say they need review against saved estimates and current supplier quotes.' },
  { id: 'office', name: 'Office manager', prompt: 'You are the office manager for a construction company. Draft short, friendly, professional customer messages, follow-ups and scheduling notes. Keep drafts ready to copy, and mark anything that needs a human decision.' },
  { id: 'foreman', name: 'Field foreman', prompt: 'You are a field foreman talking to a crew member on a job site. Use short, plain sentences that sound natural read aloud. Give step-by-step task and safety checklists. Say when something needs a supervisor.' },
]

const PREFERRED = /(gpt-oss|llama|gemini|deepseek|qwen|mistral)/i

const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

function money(value) {
  return value == null ? 'no limit' : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
}

export default function AiTestPage() {
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(false)
  const [models, setModels] = useState([])
  const [model, setModel] = useState('')
  const [modelsError, setModelsError] = useState('')
  const [role, setRole] = useState(ROLES[0].id)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const [speak, setSpeak] = useState(false)
  const recognition = useRef(null)
  const bottom = useRef(null)

  async function checkKey() {
    setChecking(true)
    try { setStatus(await request('/ai/status')) }
    catch (caught) { setStatus({ configured: false, valid: false, message: caught.message }) }
    finally { setChecking(false) }
  }

  async function loadModels() {
    setModelsError('')
    try {
      const data = await request('/ai/models')
      setModels(data.models)
      setModel((current) => current || (data.models.find((m) => m.id === 'openrouter/free') || data.models.find((m) => m.free && PREFERRED.test(m.id)) || data.models[0])?.id || '')
    } catch (caught) { setModelsError(caught.message) }
  }

  useEffect(() => { checkKey(); loadModels(); return () => { recognition.current?.abort(); window.speechSynthesis?.cancel() } }, [])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }) }, [messages, busy])

  async function ask(text) {
    const content = text.trim()
    if (!content || busy || !model) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next); setInput(''); setError(''); setBusy(true)
    try {
      const result = await send('/ai/chat', 'POST', { model, system: ROLES.find((r) => r.id === role).prompt, messages: next.slice(-20) })
      setMessages([...next, { role: 'assistant', content: result.reply || '(empty reply)', meta: `${result.model} · ${result.seconds}s${result.usage ? ` · ${result.usage.total_tokens} tokens` : ''}` }])
      if (speak && result.reply && window.speechSynthesis) {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.reply))
      }
    } catch (caught) {
      setError(caught.message)
      setMessages(messages)
      setInput(content)
    } finally { setBusy(false) }
  }

  function toggleMic() {
    if (listening) { recognition.current?.stop(); return }
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.interimResults = true
    let finalText = ''
    rec.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join('')
      setInput(text)
      if (event.results[event.results.length - 1].isFinal) finalText = text
    }
    rec.onerror = (event) => setError(event.error === 'not-allowed' ? 'Microphone permission was blocked. Allow it in the browser address bar.' : `Voice input error: ${event.error}`)
    rec.onend = () => { setListening(false); if (finalText) ask(finalText) }
    recognition.current = rec
    setError('')
    setListening(true)
    rec.start()
  }

  const selected = models.find((m) => m.id === model)
  const StatusIcon = status?.valid ? CheckCircle2 : XCircle

  return <div className="workspace fade-in">
    <p className="eyebrow text-maroon">Connection test</p>
    <h1 className="page-title mt-2">AI test</h1>
    <p className="text-steel mt-2 max-w-2xl">Check that the OpenRouter key works and try models, roles and voice. Nothing from your jobs or estimates is sent.</p>

    <section className="card mt-6 p-5" aria-labelledby="key-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><KeyRound size={18} className="text-maroon" /><h2 id="key-title" className="section-title">OpenRouter key</h2></div>
        <button className="btn-ghost" onClick={checkKey} disabled={checking}><RefreshCw size={15} className={checking ? 'animate-spin' : ''} /><span>Check again</span></button>
      </div>
      {!status ? <Loading label="Checking key…" /> : <div className="mt-4">
        <div className={`flex items-center gap-2 font-semibold ${status.valid ? 'text-ok' : 'text-danger'}`}><StatusIcon size={18} />{status.valid ? 'Key works' : status.configured ? 'Key is set but not working' : 'No key on the server'}</div>
        <p className="text-sm text-steel mt-1">{status.message}</p>
        {status.valid ? <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div><dt className="text-xs text-steel">Label</dt><dd className="font-medium break-words">{status.label || '—'}</dd></div>
          <div><dt className="text-xs text-steel">Used so far</dt><dd className="font-medium">{money(status.usage)}</dd></div>
          <div><dt className="text-xs text-steel">Key limit</dt><dd className="font-medium">{money(status.limit)}</dd></div>
          <div><dt className="text-xs text-steel">Account</dt><dd className="font-medium">{status.is_free_tier ? 'Free tier (no credits bought)' : 'Credits purchased'}</dd></div>
        </dl> : null}
        <div className="flex flex-wrap gap-2 mt-4"><Tag tone={status.paid_models_allowed ? 'warn' : 'ok'}>{status.paid_models_allowed ? 'Paid models allowed' : 'Free models only'}</Tag></div>
      </div>}
    </section>

    <section className="card mt-6 overflow-hidden" aria-labelledby="chat-title">
      <div className="bg-paper p-4 sm:p-5 border-b border-line">
        <div className="flex items-center gap-2"><Sparkles size={18} className="text-maroon" /><h2 id="chat-title" className="section-title">Try it</h2></div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="min-w-0"><label htmlFor="ai-model" className="label">Model</label>
            <select id="ai-model" className="field" value={model} onChange={(e) => setModel(e.target.value)} disabled={!models.length}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.free ? '' : '$ '}{m.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-steel">{models.length ? `${models.length} models available${selected ? ` · ${selected.free ? 'free' : 'paid'}` : ''}` : 'Loading models…'}</p>
          </div>
          <div className="min-w-0"><label htmlFor="ai-role" className="label">Role</label>
            <select id="ai-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-steel line-clamp-2">{ROLES.find((r) => r.id === role).prompt}</p>
          </div>
        </div>
        {modelsError ? <div className="mt-3"><Alert message={modelsError}><button className="btn-ghost" onClick={loadModels}>Try again</button></Alert></div> : null}
      </div>

      <div className="p-4 sm:p-5 space-y-3 max-h-[55vh] overflow-y-auto" aria-live="polite">
        {!messages.length && !busy ? <p className="text-sm text-steel">Try: “Scope a 12 by 14 bathroom remodel with a walk-in shower” as the Estimator, or press the mic and talk.</p> : null}
        {messages.map((m, i) => <div key={i} className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'ml-auto bg-maroon text-white' : 'bg-sand'}`}>
          {m.content}
          {m.meta ? <p className="mt-2 text-[11px] text-steel">{m.meta}</p> : null}
        </div>)}
        {busy ? <Loading label="Waiting for the model…" /> : null}
        <div ref={bottom} />
      </div>

      <form className="border-t border-line p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        <Alert message={error} />
        <div className="flex gap-2 mt-2">
          {SpeechRecognition ? <button type="button" className={listening ? 'btn-primary shrink-0' : 'btn-ghost shrink-0'} onClick={toggleMic} aria-label={listening ? 'Stop listening' : 'Speak'} aria-pressed={listening} disabled={busy}>
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button> : null}
          <input className="field" maxLength={4000} placeholder={listening ? 'Listening…' : 'Ask something…'} value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} aria-label="Message" />
          <button className="btn-primary shrink-0" disabled={busy || !input.trim() || !model}><Send size={16} /><span className="hidden sm:inline">Send</span></button>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-[#6D2431]" checked={speak} onChange={(e) => { setSpeak(e.target.checked); if (!e.target.checked) window.speechSynthesis?.cancel() }} /><Volume2 size={15} />Read replies aloud</label>
          {messages.length ? <button type="button" className="inline-flex items-center gap-1.5 text-steel hover:text-ink" onClick={() => { setMessages([]); window.speechSynthesis?.cancel() }}><Trash2 size={14} />Clear chat</button> : null}
          {!SpeechRecognition ? <span className="text-xs text-steel">Voice input needs Chrome or Edge.</span> : null}
        </div>
      </form>
    </section>
  </div>
}
