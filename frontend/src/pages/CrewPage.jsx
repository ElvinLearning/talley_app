import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import Avatar from '../components/Avatar'
import Logo from '../components/Logo'
import { api } from '../lib/api'

export default function CrewPage() {
  const [team, setTeam] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .team()
      .then(setTeam)
      .catch((caught) => setError(caught.message || 'Could not load the crew'))
  }, [])

  const members = team || []
  const assigned = members.reduce((sum, member) => sum + Number(member.open_items || 0), 0)

  return (
    <div className="min-h-full bg-sand">
      <header className="sticky top-0 z-30 bg-sand/95 px-4 pb-3 pt-4 backdrop-blur">
        <Logo size={28} wordmark={false} />
        <h1 className="mt-3 font-serif text-[25px] leading-none text-ink">Crew</h1>
        <p className="mt-1.5 text-[11.5px] text-steel">
          {members.length} people · {assigned} open assignments
        </p>
      </header>

      <div className="space-y-2.5 px-4 pb-8">
        {error ? <p className="card p-4 text-xs text-[#8C2C1B]">{error}</p> : null}

        {members.map((member) => {
          const open = Number(member.open_items || 0)
          const blocked = Number(member.blocked_items || 0)
          return (
            <div key={member.id} className="card flex items-center gap-3 p-3.5">
              <Avatar name={member.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{member.name}</p>
                <p className="truncate text-[11.5px] text-steel">{member.role}</p>
                {member.phone ? (
                  <a
                    href={`tel:${member.phone}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-maroon"
                  >
                    <Phone size={11} />
                    {member.phone}
                  </a>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-serif text-[17px] leading-none text-ink">{open}</p>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-steel">open</p>
                {blocked > 0 ? (
                  <p className="mt-1.5 rounded-full bg-[#F6DAD5] px-2 py-0.5 text-[10px] font-semibold text-[#8C2C1B]">
                    {blocked} blocked
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}

        {!members.length && !error ? (
          <div className="card px-4 py-8 text-center text-[11.5px] text-steel">No crew on file yet.</div>
        ) : null}
      </div>
    </div>
  )
}
