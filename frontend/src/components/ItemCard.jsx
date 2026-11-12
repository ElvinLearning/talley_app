import { Calendar, ChevronRight, MessageSquare } from 'lucide-react'
import Avatar from './Avatar'
import StatusPill from './StatusPill'
import { dueLabel, isOverdue } from '../lib/format'

/** A task as a tappable card — the phone layout of the task sheet. */
export default function ItemCard({ item, onOpen }) {
  const overdue = isOverdue(item.due_date, item.status)
  const due = dueLabel(item.due_date, item.status)

  return (
    <button type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-paper">
      <span className="min-w-0 flex-1">
        <span className={`block font-medium leading-snug ${item.status === 'done' ? 'text-steel line-through decoration-steel/40' : 'text-ink'}`}>{item.name}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-steel">
          <StatusPill status={item.status} />
          {due ? (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-danger' : ''}`}>
              <Calendar size={13} aria-hidden="true" />
              {due}
            </span>
          ) : null}
          {item.notes ? <MessageSquare size={13} aria-label="Has notes" /> : null}
        </span>
      </span>
      <Avatar name={item.owner} size={28} />
      <ChevronRight size={16} className="shrink-0 text-steel-light" aria-hidden="true" />
    </button>
  )
}
