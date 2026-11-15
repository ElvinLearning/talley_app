import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysFromToday, dollars, dueInfo, isOverdue, timeAgo } from '../../src/lib/format.js'

const iso = (offset) => {
  const day = new Date()
  day.setDate(day.getDate() + offset)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

test('due dates count whole days from today', () => {
  // Regression: these were all off by one (a task due today read "Tomorrow").
  assert.equal(daysFromToday(iso(0)), 0)
  assert.equal(daysFromToday(iso(1)), 1)
  assert.equal(daysFromToday(iso(-1)), -1)
  assert.equal(daysFromToday(iso(-14)), -14)
  assert.equal(daysFromToday(''), null)
})

test('due wording and lateness', () => {
  assert.equal(dueInfo(iso(0)).label, 'Today')
  assert.equal(dueInfo(iso(1)).label, 'Tomorrow')
  assert.equal(dueInfo(iso(-1)).late, '1 day late')
  assert.equal(dueInfo(iso(-3)).tone, 'late')
  assert.equal(dueInfo(iso(-3), 'done').tone, 'done')
  assert.equal(isOverdue(iso(-1), 'in_progress'), true)
  assert.equal(isOverdue(iso(0), 'in_progress'), false)
  assert.equal(isOverdue(iso(-1), 'done'), false)
  assert.equal(dueInfo(null), null)
})

test('money and timestamps', () => {
  assert.equal(dollars(133740), '$1,337.40')
  assert.equal(dollars(0), '$0.00')
  // Both server timestamp styles parse: with a zone and (older rows) without.
  const now = new Date()
  assert.equal(timeAgo(now.toISOString().replace('Z', '+00:00')), 'just now')
  assert.equal(timeAgo(new Date(now.getTime() - 5 * 60000).toISOString().slice(0, 19)), '5m ago')
  assert.equal(timeAgo('not a date'), '')
})
