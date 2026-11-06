const DAY = 24 * 60 * 60 * 1000

const startOfToday = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

const parseDay = (iso) => {
  if (!iso) return null
  const parsed = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function money(value = 0) {
  const amount = Number(value) || 0
  if (amount === 0) return '$0'
  if (Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000
    return `$${millions.toFixed(Number.isInteger(millions) ? 0 : 2)}M`
  }
  if (Math.abs(amount) >= 1_000) return `$${Math.round(amount / 1000)}K`
  return `$${Math.round(amount)}`
}

export function moneyFull(value = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function shortDate(iso) {
  const date = parseDay(iso)
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function longDate(iso) {
  const date = parseDay(iso)
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function daysFromToday(iso) {
  const date = parseDay(iso)
  if (!date) return null
  return Math.round((date.getTime() - startOfToday().getTime()) / DAY)
}

export function dueLabel(iso, status) {
  const days = daysFromToday(iso)
  if (days === null) return null
  if (status === 'done') return shortDate(iso)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return '1 day late'
  if (days < 0) return `${Math.abs(days)} days late`
  return shortDate(iso)
}

export const isOverdue = (iso, status) => {
  const days = daysFromToday(iso)
  return days !== null && days < 0 && status !== 'done'
}

export function timeAgo(stamp) {
  if (!stamp) return ''
  const then = new Date(`${stamp.replace(' ', 'T')}Z`).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.max(1, Math.round((Date.now() - then) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days}d ago`
  return `${Math.round(days / 7)}w ago`
}
