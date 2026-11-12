// Small shared building blocks so every screen uses the same fields, messages
// and status language.
import { cloneElement, useId } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { href } from '../lib/router'
import { stageMeta } from '../lib/statuses'

/** A labelled input. Pass a child to use a select or textarea instead. */
export function Field({ label, hint, error, children, className = '', ...props }) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const shared = { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy }
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children ? cloneElement(children, shared) : <input className="field" {...shared} {...props} />}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-steel">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Alert({ message, tone = 'error', children }) {
  if (!message) return null
  const styles =
    tone === 'error'
      ? 'border-danger/30 bg-danger-tint text-danger'
      : tone === 'warn'
        ? 'border-warn/30 bg-warn-tint text-warn'
        : 'border-ok/30 bg-ok-tint text-ok'
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-3 text-sm ${styles}`}
    >
      <Icon size={17} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 font-medium">{message}</p>
      {children}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <p role="status" className="flex items-center gap-2.5 px-1 py-10 text-sm text-steel">
      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
      {label}
    </p>
  )
}

/** A failed load with a way to try again. */
export function LoadError({ message, onRetry, children }) {
  return (
    <div className="card mx-auto mt-6 max-w-lg p-6 text-center">
      <AlertTriangle className="mx-auto text-danger" size={26} aria-hidden="true" />
      <h2 className="mt-3 font-serif text-xl">This didn’t load</h2>
      <p role="alert" className="mt-1.5 text-sm text-steel">
        {message}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <button type="button" className="btn-primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="px-6 py-12 text-center">
      {Icon ? <Icon className="mx-auto text-steel-light" size={30} strokeWidth={1.6} aria-hidden="true" /> : null}
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      {children ? <p className="mx-auto mt-1.5 max-w-sm text-sm text-steel">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function BackLink({ to, children }) {
  return (
    <a href={href(to)} className="no-print -ml-1.5 inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-1.5 text-sm font-semibold text-maroon hover:bg-maroon-tint">
      <ArrowLeft size={16} aria-hidden="true" />
      {children}
    </a>
  )
}

/** Job stage as a dot plus words — never colour alone. */
export function StageChip({ stage, className = '' }) {
  const meta = stageMeta(stage)
  return (
    <span className={`chip ${className}`} style={{ backgroundColor: meta.bg, color: meta.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.dot }} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export function Tag({ tone = 'neutral', children }) {
  const styles = {
    neutral: 'bg-[#ECE7E0] text-[#4F4943]',
    danger: 'bg-[#F6DAD5] text-[#8C2C1B]',
    warn: 'bg-[#F7E5BF] text-[#6F4204]',
    ok: 'bg-[#D8E8DE] text-[#1F5239]',
    brand: 'bg-maroon-tint text-maroon',
  }
  return <span className={`chip ${styles[tone]}`}>{children}</span>
}
