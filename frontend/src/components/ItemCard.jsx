import { Calendar, ChevronRight } from 'lucide-react'
import Avatar from './Avatar'
import StatusPill from './StatusPill'
import { dueLabel, isOverdue, money } from '../lib/format'

export default function ItemCard({ item, onOpen }) {
  const overdue = isOverdue(item.due_date, item.status)
  const due = dueLabel(item.due_date, item.status)

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="card flex w-full items-start gap-3 p-3.5 text-left transition active:scale-[0.994] active:bg-paper"
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-[14.5px] font-semibold leading-snug ${
            item.status === 'done' ? 'text-steel line-through decoration-steel/40' : 'text-ink'
          }`}
        >
          {item.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-steel">
          <StatusPill status={item.status} />
          {due ? (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-[#B42318]' : ''}`}>
              <Calendar size={12.5} className={overdue ? 'text-[#B42318]' : 'text-steel-light'} />
              {due}
            </span>
          ) : null}
          {Number(item.cost) > 0 ? <span className="tabular-nums">{money(item.cost)}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
        <Avatar name={item.owner} size={26} />
        <ChevronRight size={14} className="text-steel/50" />
      </div>
    </button>
  )
}
