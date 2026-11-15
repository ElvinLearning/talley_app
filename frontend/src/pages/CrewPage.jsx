import { useCallback, useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import Avatar from '../components/Avatar'
import { EmptyState, LoadError, Loading, Tag } from '../components/ui'
import { api } from '../lib/api'

const ROLE = { admin: 'Administrator', worker: 'Field crew' }

/** Who is on the team and how much open work each person owns. */
export default function CrewPage() {
  const [team, setTeam] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setTeam(await api.team())
      setError('')
    } catch (caught) {
      setError(caught.message || 'Could not load the crew')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const members = team || []
  const assigned = members.reduce((sum, member) => sum + Number(member.open_items || 0), 0)

  return (
    <div className="workspace">
      <h1 className="page-title">Crew</h1>
      <p className="mt-1 text-sm text-steel">{team ? `${members.length} ${members.length === 1 ? 'person' : 'people'} · ${assigned} open task${assigned === 1 ? '' : 's'} assigned` : 'Who owns what.'}</p>

      {error ? <LoadError message={error} onRetry={load} /> : null}
      {!team && !error ? <Loading label="Loading crew…" /> : null}
      {team && !members.length ? (
        <div className="card mt-5">
          <EmptyState title="No crew on file yet">People appear here once they have an account.</EmptyState>
        </div>
      ) : null}

      <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => {
          const open = Number(member.open_items || 0)
          const blocked = Number(member.blocked_items || 0)
          return (
            <li key={member.id} className="card flex items-center gap-3.5 p-4">
              <Avatar name={member.name} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{member.name}</p>
                <p className="truncate text-[13px] text-steel">{ROLE[member.role] || member.role}</p>
                {member.phone ? (
                  <a href={`tel:${member.phone}`} className="link mt-1 inline-flex items-center gap-1.5 text-[13px]">
                    <Phone size={13} aria-hidden="true" />
                    {member.phone}
                  </a>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular text-sm">
                  <span className="font-serif text-xl">{open}</span> <span className="text-steel">open</span>
                </p>
                {blocked > 0 ? <Tag tone="danger">{blocked} blocked</Tag> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
