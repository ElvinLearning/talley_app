import { statusMeta } from '../lib/statuses'

export default function StatusPill({ status, className = '' }) {
  const meta = statusMeta(status)
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${className}`}
      style={{ backgroundColor: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  )
}
