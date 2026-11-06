import { useMemo, useState } from 'react'
import { ChevronRight, MapPin, Plus, Search } from 'lucide-react'
import Logo from '../components/Logo'
import NewProjectSheet from '../components/NewProjectSheet'
import ProgressBar from '../components/ProgressBar'
import { money } from '../lib/format'

function ProjectCard({ board, onOpen }) {
  const total = Number(board.total_items) || 0
  const done = Number(board.done_items) || 0
  const blocked = Number(board.blocked_items) || 0
  const percent = total ? (done / total) * 100 : 0

  return (
    <button
      type="button"
      onClick={() => onOpen(board.id)}
      className="card w-full p-4 text-left transition active:scale-[0.995] active:bg-paper"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow truncate text-maroon/70">{board.client || 'Internal'}</p>
          <h3 className="mt-1 font-serif text-[16.5px] leading-snug text-ink">{board.name}</h3>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-steel/50" />
      </div>

      {board.address ? (
        <p className="mt-2 flex items-center gap-1 text-[11.5px] text-steel">
          <MapPin size={12} className="shrink-0 text-steel-light" />
          <span className="truncate">{board.address}</span>
        </p>
      ) : null}

      <ProgressBar value={percent} color={board.accent} className="mt-3.5" />

      <div className="mt-2 flex items-center justify-between text-[11.5px]">
        <span className="text-steel">
          {done} of {total} tasks
        </span>
        <span className="flex items-center gap-2">
          {blocked > 0 ? (
            <span className="rounded-full bg-[#F6DAD5] px-2 py-0.5 font-semibold text-[#8C2C1B]">
              {blocked} blocked
            </span>
          ) : null}
          <span className="font-semibold text-ink">{money(board.contract_value)}</span>
        </span>
      </div>
    </button>
  )
}

export default function ProjectsPage({ boards, onOpenBoard, onCreated }) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return boards
    return boards.filter((board) =>
      [board.name, board.client, board.address].join(' ').toLowerCase().includes(term)
    )
  }, [boards, query])

  const contractTotal = boards.reduce((sum, board) => sum + (Number(board.contract_value) || 0), 0)
  const openTasks = boards.reduce((sum, board) => sum + (Number(board.open_items) || 0), 0)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-full bg-sand">
      <header className="sticky top-0 z-30 bg-sand/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <Logo size={32} />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-3 py-2 text-xs font-semibold text-white shadow-sm active:bg-maroon-dark"
          >
            <Plus size={14} strokeWidth={2.6} />
            New
          </button>
        </div>

        <h1 className="mt-4 font-serif text-[25px] leading-none text-ink">Projects</h1>
        <p className="mt-1.5 text-[11.5px] text-steel">
          {today} · {boards.length} active job{boards.length === 1 ? '' : 's'} · {money(contractTotal)} under contract
        </p>

        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs, owners, addresses"
            aria-label="Search projects"
            className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-[13.5px] text-ink outline-none placeholder:text-steel/70 focus:border-maroon/40 focus:ring-2 focus:ring-maroon/10"
          />
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-steel">
          <span className="h-1.5 w-1.5 rounded-full bg-maroon" />
          {openTasks} open task{openTasks === 1 ? '' : 's'} across the crews
        </div>
      </header>

      <div className="space-y-3 px-4 pb-8">
        {filtered.map((board) => (
          <ProjectCard key={board.id} board={board} onOpen={onOpenBoard} />
        ))}

        {!filtered.length ? (
          <div className="card px-4 py-8 text-center">
            <p className="font-serif text-[15px] text-ink">
              {boards.length ? 'No jobs match that search' : 'No projects on the board yet'}
            </p>
            <p className="mt-1 text-xs text-steel">
              {boards.length ? 'Try a different owner or street name.' : 'Start with a project and add the scopes as you go.'}
            </p>
          </div>
        ) : null}
      </div>

      {creating ? (
        <NewProjectSheet onClose={() => setCreating(false)} onCreated={onCreated} />
      ) : null}
    </div>
  )
}
