import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, MoreHorizontal, Plus, Target } from 'lucide-react'
import AddTaskSheet from '../components/AddTaskSheet'
import ItemCard from '../components/ItemCard'
import ItemSheet from '../components/ItemSheet'
import ProgressBar from '../components/ProgressBar'
import Sheet from '../components/Sheet'
import ProjectAccess from '../components/ProjectAccess'
import { api } from '../lib/api'
import { money, shortDate, timeAgo } from '../lib/format'

const DOT_COLORS = {
  done: '#2E7D5B',
  blocked: '#C0392B',
  add: '#4A6FA5',
  delete: '#808080',
  update: '#6D2431',
}

function BoardMenu({ board, onClose, onAddGroup, onDelete, deleting }) {
  const [name, setName] = useState('')

  return (
    <Sheet title="Board settings" subtitle={board.name} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) onAddGroup(name.trim())
        }}
        className="space-y-2 pb-4"
      >
        <label className="label" htmlFor="new-group-name">
          Add a scope group
        </label>
        <div className="flex gap-2">
          <input
            id="new-group-name"
            className="field flex-1"
            placeholder="e.g. Roofing"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="btn-primary shrink-0 px-4" disabled={!name.trim()}>
            Add
          </button>
        </div>
      </form>

      <div className="rounded-xl bg-[#FBF4F4] p-3">
        <p className="text-[12.5px] font-semibold text-[#8C2C1B]">Delete this project</p>
        <p className="mt-1 text-[11.5px] leading-snug text-[#8C2C1B]/80">
          Every group, task and note on this board is removed. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 w-full rounded-lg border border-[#8C2C1B]/30 bg-white py-2 text-xs font-semibold text-[#8C2C1B] active:bg-[#F6DAD5]"
        >
          {deleting ? 'Tap again to delete permanently' : 'Delete project'}
        </button>
      </div>
    </Sheet>
  )
}

export default function BoardPage({ boardId, onBack, onChanged }) {
  const [board, setBoard] = useState(null)
  const [team, setTeam] = useState([])
  const [error, setError] = useState('')
  const [activeItem, setActiveItem] = useState(null)
  const [addTaskGroup, setAddTaskGroup] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [detail, members] = await Promise.all([api.board(boardId), api.team()])
      setBoard(detail)
      setTeam(members)
      setError('')
    } catch (caught) {
      setError(caught.message || 'Could not load this project')
    }
  }, [boardId])

  useEffect(() => {
    load()
  }, [load])

  const refresh = async () => {
    await load()
    onChanged?.()
  }

  const scrollToGroup = (groupId) => {
    const target = document.getElementById(`group-${groupId}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-sand px-8 text-center">
        <p className="font-serif text-lg text-ink">This project did not load</p>
        <p className="text-xs text-steel">{error}</p>
        <button type="button" className="btn-primary mt-1" onClick={load}>
          Try again
        </button>
        <button type="button" className="text-xs font-semibold text-steel underline" onClick={onBack}>
          Back to projects
        </button>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="min-h-full bg-sand px-4 pt-6">
        <div className="mx-1 h-36 animate-pulse rounded-2xl bg-black/[0.06]" />
        <div className="mt-4 space-y-2">
          <div className="h-16 animate-pulse rounded-2xl bg-black/[0.05]" />
          <div className="h-16 animate-pulse rounded-2xl bg-black/[0.05]" />
          <div className="h-16 animate-pulse rounded-2xl bg-black/[0.05]" />
        </div>
      </div>
    )
  }

  const total = Number(board.total_items) || 0
  const done = Number(board.done_items) || 0
  const blocked = Number(board.blocked_items) || 0
  const percent = total ? (done / total) * 100 : 0
  const activeGroupName = activeItem
    ? board.groups.find((group) => group.items.some((entry) => entry.id === activeItem.id))?.name
    : ''

  return (
    <div className="min-h-full bg-sand">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-black/[0.06] bg-sand/95 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to projects"
          className="rounded-full p-1.5 text-ink active:bg-black/5"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate text-maroon/70">{board.client || 'Internal'}</p>
          <h1 className="truncate font-serif text-[15px] leading-tight text-ink">{board.name}</h1>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Board settings"
          className="rounded-full p-1.5 text-ink active:bg-black/5"
        >
          <MoreHorizontal size={19} />
        </button>
      </header>

      <ProjectAccess boardId={boardId} />
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-maroon p-4 text-white shadow-lift">
          <p className="text-[11.5px] leading-snug text-white/75">{board.address || 'No job address on file'}</p>

          <div className="mt-3.5 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/55">Contract</p>
              <p className="mt-0.5 font-serif text-[17px] leading-none">{money(board.contract_value)}</p>
            </div>
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/55">Committed</p>
              <p className="mt-0.5 font-serif text-[17px] leading-none">{money(board.committed)}</p>
            </div>
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/55">Complete</p>
              <p className="mt-0.5 font-serif text-[17px] leading-none">{Math.round(percent)}%</p>
            </div>
          </div>

          <ProgressBar value={percent} color="#FFFFFF" track="rgba(255,255,255,0.22)" className="mt-3.5" />

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/70">
            <span>
              {done} of {total} tasks closed
            </span>
            <span className="inline-flex items-center gap-1">
              <Target size={11.5} />
              {shortDate(board.target_date)}
            </span>
          </div>

          {blocked > 0 ? (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/12 px-2.5 py-2 text-[11.5px] font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A73]" />
              {blocked} task{blocked === 1 ? '' : 's'} blocked — needs a call
            </div>
          ) : null}
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {board.groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => scrollToGroup(group.id)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink shadow-card ring-1 ring-black/[0.06] active:bg-paper"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {board.groups.map((group) => (
          <section key={group.id} id={`group-${group.id}`} className="mb-5 scroll-mt-[72px]">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-4 w-1.5 rounded-full" style={{ backgroundColor: group.color }} />
              <h2 className="font-serif text-[15px] text-ink">{group.name}</h2>
              <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-steel">
                {group.items.length}
              </span>
              <button
                type="button"
                onClick={() => setAddTaskGroup(group)}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-maroon ring-1 ring-black/[0.06] active:bg-maroon-tint"
              >
                <Plus size={12} strokeWidth={2.6} />
                Task
              </button>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <ItemCard key={item.id} item={item} onOpen={setActiveItem} />
              ))}
              {!group.items.length ? (
                <p className="rounded-xl border border-dashed border-black/10 bg-white/50 px-3 py-4 text-center text-[11.5px] text-steel">
                  Nothing scheduled in this scope yet
                </p>
              ) : null}
            </div>
          </section>
        ))}

        <section className="mb-8 rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
          <h2 className="eyebrow text-steel">Recent activity</h2>
          <ul className="mt-2.5 space-y-2.5">
            {board.activity.map((entry) => (
              <li key={entry.id} className="flex gap-2.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: DOT_COLORS[entry.kind] || '#6D2431' }}
                />
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-snug text-ink/90">{entry.message}</p>
                  <p className="mt-0.5 text-[10.5px] text-steel">{timeAgo(entry.created_at)}</p>
                </div>
              </li>
            ))}
            {!board.activity.length ? <li className="text-[11.5px] text-steel">Nothing logged yet.</li> : null}
          </ul>
        </section>
      </div>

      {activeItem ? (
        <ItemSheet
          item={activeItem}
          groupName={activeGroupName}
          team={team}
          onClose={() => setActiveItem(null)}
          onSaved={refresh}
          onDeleted={refresh}
        />
      ) : null}

      {addTaskGroup ? (
        <AddTaskSheet
          group={addTaskGroup}
          team={team}
          onClose={() => setAddTaskGroup(null)}
          onCreated={refresh}
        />
      ) : null}

      {menuOpen ? (
        <BoardMenu
          board={board}
          deleting={deleting}
          onClose={() => {
            setMenuOpen(false)
            setDeleting(false)
          }}
          onAddGroup={async (name) => {
            await api.addGroup(board.id, { name, color: board.accent })
            await refresh()
            setMenuOpen(false)
          }}
          onDelete={async () => {
            if (!deleting) {
              setDeleting(true)
              return
            }
            await api.deleteBoard(board.id)
            onChanged?.()
            onBack()
          }}
        />
      ) : null}
    </div>
  )
}
