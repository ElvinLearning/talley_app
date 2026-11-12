import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardList, LogOut, TrendingUp, Users } from 'lucide-react'
import Logo from './components/Logo'
import { Alert, Field, Loading } from './components/ui'
import BoardPage from './pages/BoardPage'
import CrewPage from './pages/CrewPage'
import EstimateEditor from './pages/EstimateEditor'
import JobPage from './pages/JobPage'
import JobsPage from './pages/JobsPage'
import OverviewPage from './pages/OverviewPage'
import ProjectsPage from './pages/ProjectsPage'
import ProposalPage from './pages/ProposalPage'
import { WorkerHome, WorkerJob } from './pages/WorkerPage'
import { request, send, SIGNED_OUT_EVENT } from './lib/api'
import { DraftContext } from './lib/DraftContext'
import { href, navigate, setLeaveGuard, usePath } from './lib/router'

// Development-only convenience: prefill the sign-in form from ignored
// frontend/.env.local. `import.meta.env.DEV` is false in production builds, so
// this whole object — including the values — is removed from the bundle.
const DEMO_LOGIN =
  import.meta.env.DEV && import.meta.env.VITE_DEMO_AUTOFILL === '1'
    ? { username: import.meta.env.VITE_DEMO_USERNAME || '', password: import.meta.env.VITE_DEMO_PASSWORD || '' }
    : null

const ROLE_LABEL = { admin: 'Administrator', worker: 'Field crew' }

function Login({ onLogin, notice, overlay = false }) {
  const [username, setUsername] = useState(DEMO_LOGIN?.username ?? '')
  const [password, setPassword] = useState(DEMO_LOGIN?.password ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onLogin(await send('/auth/login', 'POST', { username, password }))
    } catch (caught) {
      setError(caught.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex min-h-dvh items-center justify-center p-5 ${overlay ? '' : 'bg-sand'}`}>
      <form className="card w-full max-w-sm space-y-5 p-7" onSubmit={submit} aria-labelledby="sign-in-title">
        <Logo size={48} />
        <div>
          <h1 id="sign-in-title" className="font-serif text-[28px] leading-tight">
            Sign in
          </h1>
          <p className="mt-1.5 text-sm text-steel">Estimating and job workspace</p>
        </div>
        {notice ? <Alert tone="warn" message={notice} /> : null}
        <Field label="Username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={username} onChange={(event) => setUsername(event.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <Alert message={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-steel">A E Talley Construction · Built by Cozy Digital</p>
      </form>
    </div>
  )
}

const NAV = [
  { key: 'jobs', path: '/jobs', label: 'Jobs', Icon: ClipboardList },
  { key: 'crew', path: '/crew', label: 'Crew', Icon: Users },
  { key: 'overview', path: '/overview', label: 'Overview', Icon: TrendingUp },
]

const DEMO_NOTE = 'Demo workspace · Synthetic records and prices only · No client messages are sent'

function NotFound({ home }) {
  return (
    <div className="workspace">
      <div className="card mx-auto mt-8 max-w-lg p-8 text-center">
        <h1 className="font-serif text-2xl">That page isn’t here</h1>
        <p className="mt-2 text-sm text-steel">The link may be old, or the record may not be yours to open.</p>
        <a className="btn-primary mt-5" href={href(home)}>
          Back to {home === '/jobs' ? 'jobs' : 'my jobs'}
        </a>
      </div>
    </div>
  )
}

function adminRoute(parts) {
  const [section, id, sub, subId, leaf] = parts
  const numeric = (value) => /^\d+$/.test(value || '')
  if (!section || section === 'jobs') {
    if (!id) return { key: 'jobs', title: 'Jobs', view: <JobsPage /> }
    if (!numeric(id)) return null
    if (!sub) return { key: 'jobs', title: 'Job', view: <JobPage key={id} jobId={Number(id)} /> }
    if (sub === 'estimates' && numeric(subId)) {
      if (!leaf) return { key: 'jobs', title: 'Estimate', focus: true, view: <EstimateEditor key={subId} jobId={Number(id)} estimateId={Number(subId)} /> }
      if (leaf === 'preview') return { key: 'jobs', title: 'Client estimate', focus: true, view: <ProposalPage key={subId} jobId={Number(id)} estimateId={Number(subId)} /> }
    }
    return null
  }
  if (section === 'boards' && numeric(id) && !sub) return { key: 'overview', title: 'Project board', view: <BoardPage key={id} boardId={Number(id)} /> }
  if (parts.length > 1) return null
  if (section === 'projects') return { key: 'overview', title: 'Project boards', view: <ProjectsPage /> }
  if (section === 'crew') return { key: 'crew', title: 'Crew', view: <CrewPage /> }
  if (section === 'overview') return { key: 'overview', title: 'Overview', view: <OverviewPage /> }
  return null
}

function workerRoute(parts) {
  const [section, id, extra] = parts
  if (!section) return { title: 'My jobs', view: <WorkerHome /> }
  if (section === 'work' && /^\d+$/.test(id || '') && !extra) return { title: 'Job', view: <WorkerJob key={id} boardId={Number(id)} /> }
  return null
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = checking, null = signed out
  const [expired, setExpired] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const path = usePath()
  const main = useRef(null)

  useEffect(() => {
    request('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  // A request came back 401 while working: ask for sign-in on top of the
  // current screen so unsaved work is still there afterwards.
  useEffect(() => {
    const onSignedOut = () => setExpired(true)
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

  // Screens with unsaved work report it here. The router guard is set in the
  // same call (not in an effect) so "save, then navigate" never prompts.
  const reportDirty = useCallback((value) => {
    setLeaveGuard(value ? () => window.confirm('You have unsaved changes. Leave without saving?') : null)
    setDirty(value)
  }, [])

  const parts = path.split('/').filter(Boolean)
  const isAdmin = user?.role === 'admin'
  const route = user ? (isAdmin ? adminRoute(parts) : workerRoute(parts)) : null
  const title = route?.title

  useEffect(() => {
    document.title = title ? `${title} · A E Talley` : 'A E Talley Construction'
  }, [title])

  // New screen: start at the top and move keyboard focus to the content.
  useEffect(() => {
    if (!main.current) return
    main.current.scrollTop = 0
    main.current.focus({ preventScroll: true })
  }, [path])

  if (user === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-sand">
        <Loading label="Opening workspace…" />
      </div>
    )
  }

  if (!user) {
    return (
      <Login
        onLogin={(next) => {
          setExpired(false)
          navigate('/', { replace: true })
          setUser(next)
        }}
      />
    )
  }

  async function signOut() {
    if (dirty && !window.confirm('You have unsaved changes. Sign out without saving?')) return
    try {
      await send('/auth/logout', 'POST')
    } catch (caught) {
      setError(caught.message)
      return
    }
    setDirty(false)
    setLeaveGuard(null)
    setExpired(false)
    navigate('/', { replace: true })
    setUser(null)
  }

  const home = isAdmin ? '/jobs' : '/'
  const signOutButton = (
    <button type="button" className="btn-ghost" onClick={signOut}>
      <LogOut size={16} aria-hidden="true" />
      {user.demo_access ? 'Switch user' : 'Sign out'}
    </button>
  )

  return (
    <DraftContext.Provider value={reportDirty}>
      <div id="app-shell" className="relative flex h-dvh overflow-hidden bg-sand">
        <a className="skip-link no-print" href="#main" onClick={(event) => { event.preventDefault(); main.current?.focus() }}>
          Skip to content
        </a>

        {isAdmin ? (
          <aside className="no-print hidden w-[232px] shrink-0 flex-col border-r border-line bg-white lg:flex">
            <a href={href('/jobs')} className="block px-5 py-5" aria-label="A E Talley Construction — jobs">
              <Logo size={36} />
            </a>
            <nav aria-label="Main" className="flex-1 space-y-1 px-3">
              {NAV.map(({ key, path: to, label, Icon }) => {
                const active = route?.key === key
                return (
                  <a
                    key={key}
                    href={href(to)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      active ? 'bg-maroon-tint text-maroon' : 'text-ink/80 hover:bg-sand'
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
                    {label}
                  </a>
                )
              })}
            </nav>
            <p className="mx-3 mb-3 rounded-lg bg-maroon-tint px-3 py-2.5 text-xs leading-snug text-maroon">{DEMO_NOTE}</p>
            <div className="border-t border-line px-4 py-4">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="mb-3 text-xs text-steel">{ROLE_LABEL[user.role]}</p>
              {signOutButton}
            </div>
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className={`no-print flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5 sm:px-6 ${isAdmin ? 'lg:hidden' : ''}`}>
            <a href={href(home)} aria-label="A E Talley Construction — home">
              <Logo size={34} />
            </a>
            <div className="flex items-center gap-3">
              <span className="hidden text-right text-sm leading-tight sm:block">
                <span className="block font-semibold">{user.name}</span>
                <span className="text-xs text-steel">{ROLE_LABEL[user.role]}</span>
              </span>
              {signOutButton}
            </div>
          </header>
          <p className={`no-print shrink-0 bg-maroon-tint px-4 py-1.5 text-xs text-maroon sm:px-6 ${isAdmin ? 'lg:hidden' : ''}`}>{DEMO_NOTE}</p>

          <main id="main" ref={main} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <div className="workspace !pb-0">
                <Alert message={error} />
              </div>
            ) : null}
            <Fragment key={user.id}>{route ? route.view : <NotFound home={home} />}</Fragment>
          </main>

          {isAdmin && !route?.focus ? (
            <nav aria-label="Main" className="no-print flex shrink-0 justify-around border-t border-line bg-white px-2 pb-safe lg:hidden">
              {NAV.map(({ key, path: to, label, Icon }) => {
                const active = route?.key === key
                return (
                  <a
                    key={key}
                    href={href(to)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 pt-1.5 text-xs font-semibold ${
                      active ? 'text-maroon' : 'text-steel'
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
                    {label}
                  </a>
                )
              })}
            </nav>
          ) : null}
        </div>

        {expired ? (
          <div className="no-print absolute inset-0 z-[60] overflow-y-auto bg-ink/50" role="dialog" aria-modal="true" aria-label="Sign in again">
            <Login
              overlay
              notice="Your session ended. Sign in again — anything you were working on is still here."
              onLogin={(next) => {
                setExpired(false)
                if (next.id !== user.id) {
                  setDirty(false)
                  setLeaveGuard(null)
                  navigate('/', { replace: true })
                  setUser(next)
                }
              }}
            />
          </div>
        ) : null}
      </div>
    </DraftContext.Provider>
  )
}
