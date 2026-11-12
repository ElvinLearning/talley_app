import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { send } from '../lib/api'
import { STAGE, stageMeta } from '../lib/statuses'

/**
 * Change a job's stage in place. Only offers moves the server allows:
 * "Approved" is set by recording an approval, and "Active" needs a project.
 */
export default function StageSelect({ job, onChanged, onError }) {
  const [busy, setBusy] = useState(false)
  const meta = stageMeta(job.status)
  const choices = job.project ? ['active', 'on_hold', 'complete'] : ['lead', 'estimating', 'on_hold', 'complete']
  const options = choices.includes(job.status) ? choices : [job.status, ...choices]

  async function change(event) {
    const status = event.target.value
    setBusy(true)
    onError?.('')
    try {
      onChanged(await send(`/jobs/${job.id}/status`, 'PATCH', { status }))
    } catch (caught) {
      onError?.(caught.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="relative inline-flex items-center" onClick={(event) => event.stopPropagation()}>
      <span className="pointer-events-none absolute left-2.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.dot }} aria-hidden="true" />
      <select
        aria-label={`Stage for ${job.name}`}
        value={job.status}
        disabled={busy}
        onChange={change}
        className="h-7 cursor-pointer appearance-none rounded-full border-0 pl-[22px] pr-7 text-xs font-semibold disabled:opacity-60"
        style={{ backgroundColor: meta.bg, color: meta.fg }}
      >
        {options.map((stage) => (
          <option key={stage} value={stage} disabled={stage === 'approved' && job.status !== 'approved'} style={{ backgroundColor: '#fff', color: '#241B1C' }}>
            {STAGE[stage].label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2" style={{ color: meta.fg }} aria-hidden="true" />
    </span>
  )
}
