import { useEffect, useState } from 'react'
import { Building2, ClipboardList, Users, TrendingUp, LogOut } from 'lucide-react'
import Logo from './components/Logo'
import BoardPage from './pages/BoardPage'
import CrewPage from './pages/CrewPage'
import OverviewPage from './pages/OverviewPage'
import ProjectsPage from './pages/ProjectsPage'
import JobsPage, { send, Field, Alert } from './pages/JobsPage'
import WorkerPage from './pages/WorkerPage'
import { api, request } from './lib/api'
import { DraftContext } from './lib/DraftContext'

function Login({ onLogin }) {
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  return <div className="min-h-dvh flex items-center justify-center bg-sand p-5">
    <form className="card p-7 w-full max-w-md space-y-5" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{onLogin(await send('/auth/login','POST',{username,password}))}catch(e){setError(e.message)}finally{setBusy(false)}}}>
      <Logo size={56}/><div><p className="eyebrow text-maroon">Built for the work ahead</p><h1 className="font-serif text-3xl mt-2">Sign in to Talley</h1><p className="text-steel text-sm mt-2">Estimating & project workspace · Demo</p></div>
      <Field label="Username" autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/>
      <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/>
      <Alert message={error}/><button className="btn-primary w-full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p className="text-xs text-steel">A E Talley Construction · Built by Cozy Digital</p>
    </form>
  </div>
}
export default function App() {
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('jobs')
  const [boardId,setBoardId]=useState(null)
  const [boards,setBoards]=useState([])
  const [error,setError]=useState('')
  useEffect(()=>{request('/auth/me').then(setUser).catch(()=>{}).finally(()=>setLoading(false))},[])
  const [dirty,setDirty]=useState(false)
  const canLeave=()=>!dirty||window.confirm('Leave without saving this estimate?')
  const loadBoards=async()=>{try{setBoards(await api.boards());setError('')}catch(e){setError(e.message)}}
  useEffect(()=>{if(user?.role==='admin')loadBoards()},[user])
  const openBoard=id=>{setBoardId(id);setTab('board');loadBoards()}
  if(loading)return <p className="p-8 bg-sand min-h-dvh">Opening workspace…</p>
  if(!user)return <Login onLogin={setUser}/>
  const tabs=[['jobs','Jobs',ClipboardList],['projects','Projects',Building2],['crew','Crew',Users],['overview','Overview',TrendingUp]]
  return <DraftContext.Provider value={setDirty}><div id="app-shell" className="relative flex h-dvh flex-col bg-sand overflow-hidden">
    <header className="app-header flex shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-8 py-3">
      <Logo size={38}/><div className="flex items-center gap-3"><span className="text-sm hidden sm:inline">{user.name} · {user.role}</span>
        <button className="btn-ghost" onClick={async()=>{if(!canLeave())return;try{await send('/auth/logout','POST');setUser(null);setTab('jobs');setBoards([]);setDirty(false)}catch(e){setError(e.message)}}}><LogOut size={16}/><span>Sign out</span></button></div>
    </header>
    <div className="demo-banner shrink-0 px-4 sm:px-8 py-2 bg-maroon-tint text-maroon text-xs">Demo workspace · Synthetic records and prices only · No client messages are sent</div>
    <main className="min-h-0 flex-1 overflow-y-auto">
      {error&&<div className="p-4"><Alert message={error}/><button className="btn-ghost mt-2" onClick={loadBoards}>Retry</button></div>}
      {user.role==='worker'?<WorkerPage user={user}/>:tab==='jobs'?<JobsPage onOpenBoard={openBoard}/>:tab==='board'&&boardId?<BoardPage key={boardId} boardId={boardId} onBack={()=>setTab('jobs')} onChanged={loadBoards}/>:
       tab==='crew'?<CrewPage/>:tab==='overview'?<OverviewPage onOpenBoard={openBoard}/>:<ProjectsPage boards={boards} onOpenBoard={openBoard} onCreated={loadBoards}/>}
    </main>
    {user.role==='admin'&&<nav aria-label="Main navigation" className="main-nav bg-white border-t flex shrink-0 justify-around px-3 pb-safe">
      {tabs.map(([key,label,Icon])=><button key={key} className={'flex flex-1 min-w-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 min-h-12 '+(tab===key?'text-maroon bg-maroon-tint font-semibold':'text-steel')} onClick={()=>{if(key===tab||canLeave())setTab(key)}} aria-current={tab===key?'page':undefined}><Icon size={19}/><span className="text-xs sm:text-sm">{label}</span></button>)}
    </nav>}
  </div></DraftContext.Provider>
}
