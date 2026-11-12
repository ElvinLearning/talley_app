import { useCallback, useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import ActivityList from '../components/ActivityList'
import FieldAccess from '../components/FieldAccess'
import ProjectTasks from '../components/ProjectTasks'
import { Alert, BackLink, LoadError, Loading } from '../components/ui'
import { api } from '../lib/api'
import { moneyFull, shortDate } from '../lib/format'
import { href, navigate } from '../lib/router'

/**
 * A project board that was started without an estimate (the original field
 * board). Boards created from an approved estimate open on their job page instead.
 */
export default function BoardPage({ boardId }) {
  const [board, setBoard] = useState(null)
  const [team, setTeam] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openTask, setOpenTask] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const teamLoaded = useRef(false)

  const load = useCallback(async () => {
    try {
      const [detail, members] = await Promise.all([api.board(boardId), teamLoaded.current ? null : api.team()])
      if (detail.job_id) {
        navigate(`/jobs/${detail.job_id}`, { replace: true })
        return
      }
      setBoard(detail)
      if (members) {
        teamLoaded.current = true
        setTeam(members)
      }
      setError('')
    } catch (caught) {
      setError(caught.message || 'Could not load this project')
    }
  }, [boardId])

  useEffect(() => {
    load()
  }, [load])

  if (error && !board) {
    return (
      <div className="workspace">
        <LoadError message={error} onRetry={load}>
          <a className="btn-ghost" href={href('/projects')}>
            Project boards
          </a>
        </LoadError>
      </div>
    )
  }
  if (!board) {
    return (
      <div className="workspace">
        <Loading label="Opening project…" />
      </div>
    )
  }

  const owners = board.groups.flatMap((group) => group.items.filter((item) => item.status !== 'done' && item.owner).map((item) => item.owner))

  async function remove() {
    if (!deleting) {
      setDeleting(true)
      return
    }
    try {
      await api.deleteBoard(board.id)
      navigate('/projects', { replace: true })
    } catch (caught) {
      setNotice(caught.message)
      setDeleting(false)
    }
  }

  return (
    <div className="workspace">
      <BackLink to="/projects">Project boards</BackLink>
      <header className="mt-2">
        <p className="eyebrow text-maroon">{board.client || 'Internal'} · No estimate attached</p>
        <h1 className="page-title mt-1 break-words">{board.name}</h1>
        {board.address ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-steel">
            <MapPin size={16} className="mt-[3px] shrink-0" aria-hidden="true" />
            {board.address}
          </p>
        ) : null}
        <p className="tabular mt-2 text-sm text-steel">
          Contract {moneyFull(board.contract_value)} · Committed {moneyFull(board.committed)}
          {board.target_date ? ` · Target ${shortDate(board.target_date)}` : ''}
        </p>
      </header>

      <div className="mt-4">
        <Alert message={notice || error} />
      </div>

      <div className="job-grid mt-4">
        <div style={{ gridArea: 'customer' }} className="hidden" />
        <div className="min-w-0 space-y-5" style={{ gridArea: 'main' }}>
          <ProjectTasks board={board} team={team} reload={load} openTask={openTask} onOpenTask={setOpenTask} />
          <ActivityList entries={board.activity} />
        </div>
        <div className="min-w-0 space-y-5" style={{ gridArea: 'side' }}>
          <FieldAccess boardId={board.id} owners={owners} />
          <section className="card p-4" aria-labelledby="delete-title">
            <h2 id="delete-title" className="section-title">
              Delete this board
            </h2>
            <p className="mt-1 text-[13px] text-steel">Removes every section, task and note on it. This cannot be undone.</p>
            <button type="button" onClick={remove} className={`btn-ghost mt-3 text-danger ${deleting ? 'border-danger bg-danger-tint' : ''}`}>
              {deleting ? 'Click again to delete permanently' : 'Delete board'}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
