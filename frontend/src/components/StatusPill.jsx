import { statusMeta } from '../lib/statuses'

export default function StatusPill({ status, className = '' }) {
  const meta = statusMeta(status)
  return (
    <span className={`chip ${className}`} style={{ backgroundColor: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  )
}
