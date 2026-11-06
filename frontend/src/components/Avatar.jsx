import { colorFor, initialsOf } from '../lib/people'

export default function Avatar({ name = '', size = 26, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) }

  if (!name) {
    return (
      <span
        aria-label="Unassigned"
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-black/[0.06] font-semibold text-steel ring-1 ring-black/5 ${className}`}
        style={style}
      >
        ?
      </span>
    )
  }

  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5 ${className}`}
      style={{ ...style, backgroundColor: colorFor(name) }}
    >
      {initialsOf(name)}
    </span>
  )
}
