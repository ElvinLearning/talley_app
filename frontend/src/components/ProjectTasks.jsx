import { useEffect, useState } from 'react'
import { ChevronDown, ListChecks, MessageSquare, Plus } from 'lucide-react'
import ItemCard from './ItemCard'
import ProgressBar from './ProgressBar'
import TaskDialog from './TaskDialog'
import { Alert, EmptyState } from './ui'
import { api } from '../lib/api'
import { isOverdue } from '../lib/format'
import { STATUS, STATUS_ORDER, statusMeta } from '../lib/statuses'

function StatusSelect({ item, onChange }) {
  const meta = statusMeta(item.status)
  return (
    <span className="relative inline-flex w-full items-center">
      <select
        aria-label={`Status for ${item.name}`}
        value={item.status}
        onChange={(event) => onChange({ status: event.target.value })}
        className="h-8 w-full cursor-pointer appearance-none rounded-full border-0 pl-3 pr-7 text-xs font-semibold"
        style={{ backgroundColor: meta.bg, color: meta.fg }}
      >
        {STATUS_ORDER.map((key) => (
          <option key={key} value={key} style={{ backgroundColor: '#fff', color: '#241B1C' }}>
            {STATUS[key].label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5" style={{ color: meta.fg }} aria-hidden="true" />
    </span>
  )
}

/** One editable row of the sheet: owner, due date and status change in place. */
function TaskRow({ item, team, onPatch, onOpen }) {
  const overdue = isOverdue(item.due_date, item.status)
  const owners = !item.owner || team.some((member) => member.name === item.owner) ? team : [...team, { id: 'current', name: item.owner }]
  return (
    <div className="task-row border-t border-line px-4 py-1.5">
      <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 items-center gap-2 rounded-md py-1.5 text-left hover:text-maroon">
        <span className={`truncate font-medium ${item.status === 'done' ? 'text-steel line-through decoration-steel/40' : ''}`}>{item.name}</span>
        {item.notes ? <MessageSquare size={14} className="shrink-0 text-steel" aria-label="Has notes" /> : null}
      </button>
      <select aria-label={`Owner for ${item.name}`} className={`cell ${item.owner ? '' : 'text-warn'}`} value={item.owner} onChange={(event) => onPatch(item, { owner: event.target.value })}>
        <option value="">Unassigned</option>
        {owners.map((member) => (
          <option key={member.id} value={member.name}>
            {member.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        aria-label={`Due date for ${item.name}`}
        className={`cell tabular ${overdue ? 'font-semibold text-danger' : ''}`}
        value={item.due_date ? item.due_date.slice(0, 10) : ''}
        onChange={(event) => {
          const value = event.target.value
          // Typing a year passes through 0002, 0020, 0202…; only save a real date.
          if (!value || Number(value.slice(0, 4)) >= 2000) onPatch(item, { due_date: value || null })
        }}
      />
      <StatusSelect item={item} onChange={(changes) => onPatch(item, changes)} />
    </div>
  )
}

function QuickAdd({ group, onAdded, onError }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    onError('')
    try {
      await api.addItem(group.id, { name: name.trim() })
      setName('')
      await onAdded()
    } catch (caught) {
      onError(caught.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="hidden items-center gap-2 border-t border-line px-4 py-1.5 md:flex">
      <Plus size={15} className="shrink-0 text-steel" aria-hidden="true" />
      <input
        className="cell"
        aria-label={`Add a task to ${group.name}`}
        placeholder="Add a task and press Enter"
        maxLength={300}
        value={name}
        disabled={busy}
        onChange={(event) => setName(event.target.value)}
      />
    </form>
  )
}

/**
 * The task sheet for a project: sections from the approved estimate, each task
 * with an owner, a due date and a status that can be changed in place.
 */
export default function ProjectTasks({ board, team, reload, openTask, onOpenTask, addSignal = 0 }) {
  const [pending, setPending] = useState({})
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(null)
  const [newSection, setNewSection] = useState(null)

  // The job's "Add task" button asks this sheet to open its add dialog.
  const firstGroup = board.groups[0]
  useEffect(() => {
    if (!addSignal) return
    if (firstGroup) setAdding(firstGroup)
    else setNewSection('')
    // Only a new signal should reopen the dialog, not a data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal])

  const total = Number(board.total_items) || 0
  const done = Number(board.done_items) || 0
  const withPending = (item) => (pending[item.id] ? { ...item, ...pending[item.id] } : item)

  async function patch(item, changes) {
    setPending((current) => ({ ...current, [item.id]: { ...current[item.id], ...changes } }))
    setError('')
    try {
      await api.updateItem(item.id, changes)
      await reload()
    } catch (caught) {
      setError(`${item.name}: ${caught.message}`)
    } finally {
      setPending((current) => {
        const { [item.id]: _saved, ...rest } = current
        return rest
      })
    }
  }

  async function addSection(event) {
    event.preventDefault()
    if (!newSection?.trim()) return
    setError('')
    try {
      await api.addGroup(board.id, { name: newSection.trim(), color: board.accent })
      setNewSection(null)
      await reload()
    } catch (caught) {
      setError(caught.message)
    }
  }

  const opened = openTask ? board.groups.flatMap((group) => group.items.map((item) => ({ item, group }))).find((entry) => entry.item.id === openTask) : null

  return (
    <section aria-labelledby="tasks-title" className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
        <h2 id="tasks-title" className="section-title">
          Tasks
        </h2>
        {total ? (
          <span className="flex min-w-[140px] flex-1 items-center gap-3 sm:max-w-xs">
            <ProgressBar value={(done / total) * 100} color="#2E7D5B" />
            <span className="shrink-0 text-[13px] text-steel">
              {done} of {total} done
            </span>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <button type="button" className="btn-quiet ml-auto" onClick={() => setNewSection(newSection === null ? '' : null)}>
          <Plus size={16} aria-hidden="true" />
          Section
        </button>
      </div>

      {error ? (
        <div className="px-4 pb-3">
          <Alert message={error} />
        </div>
      ) : null}

      {newSection !== null ? (
        <form onSubmit={addSection} className="flex flex-wrap items-center gap-2 border-t border-line bg-paper px-4 py-3">
          <label className="sr-only" htmlFor="new-section-name">
            New section name
          </label>
          <input id="new-section-name" autoFocus className="field min-w-0 flex-1" placeholder="e.g. Punch list" maxLength={150} value={newSection} onChange={(event) => setNewSection(event.target.value)} />
          <button className="btn-primary" disabled={!newSection.trim()}>
            Add section
          </button>
          <button type="button" className="btn-ghost" onClick={() => setNewSection(null)}>
            Cancel
          </button>
        </form>
      ) : null}

      {!total ? (
        <div className="border-t border-line">
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            action={
              board.groups[0] ? (
                <button type="button" className="btn-primary" onClick={() => setAdding(board.groups[0])}>
                  <Plus size={17} aria-hidden="true" />
                  Add the first task
                </button>
              ) : null
            }
          >
            Break the work into tasks. Give each one an owner and a due date so everyone knows what’s next.
          </EmptyState>
        </div>
      ) : null}

      {total ? (
        <div className="task-head border-t border-line bg-paper px-4 py-2 text-xs font-semibold text-steel" aria-hidden="true">
          <span>Task</span>
          <span className="pl-2">Owner</span>
          <span className="pl-2">Due</span>
          <span className="pl-3">Status</span>
        </div>
      ) : null}

      {board.groups.map((group) => {
        const finished = group.items.filter((item) => item.status === 'done').length
        return (
          <div key={group.id} role="group" aria-label={group.name}>
            <div className="flex items-center gap-2.5 border-t border-line bg-sand/60 px-4 py-2">
              <h3 className="min-w-0 truncate text-sm font-semibold">{group.name}</h3>
              <span className="shrink-0 text-xs text-steel">{group.items.length ? `${finished}/${group.items.length}` : 'No tasks'}</span>
              <button type="button" onClick={() => setAdding(group)} aria-label={`Add task to ${group.name}`} className="btn-quiet ml-auto !min-h-[36px] !px-2.5 md:!min-h-[30px]">
                <Plus size={15} aria-hidden="true" />
                Task
              </button>
            </div>
            <div className="hidden md:block">
              {group.items.map((item) => (
                <TaskRow key={item.id} item={withPending(item)} team={team} onPatch={patch} onOpen={(entry) => onOpenTask(entry.id)} />
              ))}
            </div>
            <div className="divide-y divide-line border-t border-line md:hidden">
              {group.items.map((item) => (
                <ItemCard key={item.id} item={withPending(item)} onOpen={(entry) => onOpenTask(entry.id)} />
              ))}
            </div>
            {total ? <QuickAdd group={group} onAdded={reload} onError={setError} /> : null}
          </div>
        )
      })}

      {adding ? <TaskDialog group={adding} team={team} onClose={() => setAdding(null)} onSaved={reload} /> : null}
      {opened ? <TaskDialog item={opened.item} groupName={opened.group.name} team={team} onClose={() => onOpenTask(null)} onSaved={reload} /> : null}
    </section>
  )
}
