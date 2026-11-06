import { useCallback, useEffect, useState } from 'react'
import BottomNav from './components/BottomNav'
import Logo from './components/Logo'
import BoardPage from './pages/BoardPage'
import CrewPage from './pages/CrewPage'
import OverviewPage from './pages/OverviewPage'
import ProjectsPage from './pages/ProjectsPage'
import { api } from './lib/api'

export default function App() {
  const [tab, setTab] = useState('projects')
  const [boards, setBoards] = useState([])
  const [boardId, setBoardId] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const loadBoards = useCallback(async () => {
    try {
      const data = await api.boards()
      setBoards(data)
      setBoardId((current) => (data.some((board) => board.id === current) ? current : data[0]?.id ?? null))
      setStatus('ready')
    } catch (caught) {
      setError(caught.message || 'Could not reach the field board service')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadBoards()
  }, [loadBoards])

  const openBoard = (id) => {
    setBoardId(id)
    setTab('board')
  }

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-sand px-8 text-center">
          <Logo size={56} wordmark={false} />
          <div>
            <p className="font-serif text-lg text-ink">A.E. Talley</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-steel">Field board</p>
          </div>
          <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-black/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-maroon" />
          </div>
        </div>
      )
    }

    if (status === 'error') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-sand px-8 text-center">
          <p className="font-serif text-lg text-ink">The board service did not answer</p>
          <p className="text-xs text-steel">{error}</p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading')
              loadBoards()
            }}
            className="btn-primary mt-2"
          >
            Try again
          </button>
        </div>
      )
    }

    if (tab === 'board') {
      if (!boardId) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-sand px-8 text-center">
            <p className="font-serif text-lg text-ink">No projects yet</p>
            <p className="text-xs text-steel">Create a project to start tracking scopes and punch lists.</p>
            <button type="button" onClick={() => setTab('projects')} className="btn-primary mt-2">
              Go to projects
            </button>
          </div>
        )
      }
      return (
        <BoardPage
          key={boardId}
          boardId={boardId}
          onBack={() => setTab('projects')}
          onOpenBoard={openBoard}
          onChanged={loadBoards}
        />
      )
    }

    if (tab === 'crew') {
      return <CrewPage />
    }

    if (tab === 'overview') {
      return <OverviewPage onOpenBoard={openBoard} />
    }

    return <ProjectsPage boards={boards} onOpenBoard={openBoard} onCreated={loadBoards} />
  }

  return (
    <div className="flex min-h-dvh w-full items-stretch justify-center bg-[#2A0F14] md:items-center md:p-6">
      <div
        id="app-shell"
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-sand md:h-[calc(100dvh-3rem)] md:max-h-[900px] md:w-[420px] md:rounded-[34px] md:shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:ring-1 md:ring-white/10"
      >
        <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{renderBody()}</main>
        <BottomNav active={tab} onChange={setTab} boardDisabled={!boardId} />
      </div>
    </div>
  )
}
