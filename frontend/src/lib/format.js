const DAY = 24 * 60 * 60 * 1000

// Days are compared noon to noon. Comparing a noon date with midnight left
// every difference at x.5, which rounded up: a task due today read "Tomorrow"
// and one due yesterday was not late.
const noonToday = () => {
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return now
}

const parseDay = (iso) => {
  if (!iso) return null
  const parsed = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Server timestamps are UTC. Older rows have no zone suffix; newer ones do.
const parseStamp = (stamp) => {
  if (!stamp) return null
  const text = stamp.replace(' ', 'T')
  const parsed = new Date(/(Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Exact dollars and cents from integer cents. */
export const dollars = (cents) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)

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

/** "Fri, Nov 20" — a due date someone can act on without counting days. */
export function weekdayDate(iso) {
  const date = parseDay(iso)
  if (!date) return ''
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function daysFromToday(iso) {
  const date = parseDay(iso)
  if (!date) return null
  return Math.round((date.getTime() - noonToday().getTime()) / DAY)
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

/** Due date as words plus a tone: late, today, soon or later. */
export function dueInfo(iso, status) {
  const days = daysFromToday(iso)
  if (days === null) return null
  if (status === 'done') return { label: shortDate(iso), tone: 'done' }
  if (days < 0) {
    const late = `${Math.abs(days)} day${days === -1 ? '' : 's'} late`
    return { label: `${shortDate(iso)} · ${late}`, tone: 'late', date: shortDate(iso), late }
  }
  if (days === 0) return { label: 'Today', tone: 'today' }
  if (days === 1) return { label: 'Tomorrow', tone: 'soon' }
  if (days < 7) return { label: weekdayDate(iso), tone: 'soon' }
  return { label: shortDate(iso), tone: 'later' }
}

export function timeAgo(stamp) {
  const parsed = parseStamp(stamp)
  if (!parsed) return ''
  const minutes = Math.round((Date.now() - parsed.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days}d ago`
  return `${Math.round(days / 7)}w ago`
}

/** "2:41 PM" today, otherwise "Nov 11, 2:41 PM". */
export function savedAt(stamp) {
  const parsed = stamp instanceof Date ? stamp : parseStamp(stamp)
  if (!parsed) return ''
  const time = parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (parsed.toDateString() === new Date().toDateString()) return time
  return `${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

/** "Nov 11, 2026" from a server timestamp. */
export function stampDay(stamp) {
  const parsed = parseStamp(stamp)
  if (!parsed) return ''
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "November 11, 2026" from a server timestamp. */
export function stampDate(stamp) {
  const parsed = parseStamp(stamp)
  if (!parsed) return ''
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
