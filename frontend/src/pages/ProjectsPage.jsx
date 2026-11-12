import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, MapPin, Plus, Search } from 'lucide-react'
import NewProjectSheet from '../components/NewProjectSheet'
import ProgressBar from '../components/ProgressBar'
import { BackLink, EmptyState, LoadError, Loading, Tag } from '../components/ui'
import { api } from '../lib/api'
import { moneyFull } from '../lib/format'
import { href } from '../lib/router'

function ProjectCard({ board }) {
  const total = Number(board.total_items) || 0
  const done = Number(board.done_items) || 0
  const blocked = Number(board.blocked_items) || 0
  // Boards that came from an approved estimate open on their job page.
  const to = board.job_id ? `/jobs/${board.job_id}` : `/boards/${board.id}`

  return (
    <a href={href(to)} className="card block p-4 transition hover:bg-paper">
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="eyebrow block truncate text-maroon">{board.client || 'Internal'}</span>
          <span className="mt-1 block font-serif text-lg leading-snug">{board.name}</span>
        </span>
        <ChevronRight size={18} className="mt-1 shrink-0 text-steel-light" aria-hidden="true" />
      </span>
      {board.address ? (
        <span className="mt-2 flex items-center gap-1.5 text-[13px] text-steel">
          <MapPin size={13} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{board.address}</span>
        </span>
      ) : null}
      <ProgressBar value={total ? (done / total) * 100 : 0} color={board.accent} className="mt-3.5" />
      <span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-steel">
          {done} of {total} tasks
        </span>
        <span className="flex items-center gap-2">
          {blocked > 0 ? <Tag tone="danger">{blocked} blocked</Tag> : null}
          {board.job_id ? <Tag>Job #{board.job_id}</Tag> : <Tag tone="warn">No estimate</Tag>}
          <span className="tabular font-semibold">{moneyFull(board.contract_value)}</span>
        </span>
      </span>
    </a>
  )
}

/** Every project board, including ones started without an estimate. */
export default function ProjectsPage() {
  const [boards, setBoards] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setBoards(await api.boards())
      setError('')
    } catch (caught) {
      setError(caught.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return (boards || []).filter((board) => !term || [board.name, board.client, board.address].join(' ').toLowerCase().includes(term))
  }, [boards, query])

  return (
    <div className="workspace">
      <BackLink to="/overview">Overview</BackLink>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="page-title">Project boards</h1>
          <p className="mt-1 max-w-xl text-sm text-steel">Projects created from an approved estimate are managed under Jobs. A board started here has no customer, estimate or approved budget attached.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden="true" />
          Board without estimate
        </button>
      </div>

      <label className="relative mt-5 block max-w-sm">
        <span className="sr-only">Search project boards</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" aria-hidden="true" />
        <input type="search" className="field !py-2 pl-9" placeholder="Search name, client, address" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      {error ? <LoadError message={error} onRetry={load} /> : null}
      {!boards && !error ? <Loading label="Loading project boards…" /> : null}
      {boards && !filtered.length ? (
        <div className="card mt-4">
          <EmptyState title={boards.length ? 'No boards match that search' : 'No project boards yet'}>
            {boards.length ? 'Try a different name or street.' : 'Approve an estimate under Jobs and create its project to see it here.'}
          </EmptyState>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((board) => (
          <ProjectCard key={board.id} board={board} />
        ))}
      </div>

      {creating ? <NewProjectSheet onClose={() => setCreating(false)} onCreated={load} /> : null}
    </div>
  )
}
