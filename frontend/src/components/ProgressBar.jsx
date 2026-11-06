export default function ProgressBar({ value = 0, color = '#6D2431', track = '#EDE7DF', className = '' }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full ${className}`}
      style={{ backgroundColor: track }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    </div>
  )
}
