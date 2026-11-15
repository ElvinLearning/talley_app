import { timeAgo } from '../lib/format'

const DOT = { done: '#2E7D5B', blocked: '#C0392B', add: '#4A6FA5', delete: '#808080', update: '#6D2431' }

/** Recent changes on a project, newest first. */
export default function ActivityList({ entries }) {
  return (
    <section aria-labelledby="activity-title" className="card p-4">
      <h2 id="activity-title" className="section-title">
        Activity
      </h2>
      {!entries.length ? <p className="mt-2 text-sm text-steel">Nothing logged yet.</p> : null}
      <ul className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DOT[entry.kind] || DOT.update }} aria-hidden="true" />
            <span className="min-w-0 break-words text-sm">
              {entry.message}
              <span className="block text-xs text-steel">{timeAgo(entry.created_at)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
