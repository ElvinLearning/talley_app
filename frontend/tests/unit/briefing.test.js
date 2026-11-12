import test from 'node:test'
import assert from 'node:assert/strict'
import { briefJobs } from '../../src/lib/briefing.js'

const job = (id, extra = {}) => ({ id, status: 'active', next: { kind: 'task' }, estimates: [], updated_at: '2026-11-12', ...extra })
test('briefing excludes held and completed work and prioritizes blockers', () => {
  const result = briefJobs([
    job(1, { status: 'complete', tasks: { blocked: 2 } }),
    job(2, { status: 'on_hold', tasks: { blocked: 1 } }),
    job(3, { status: 'approved', next: { kind: 'convert' } }),
    job(4, { tasks: { unassigned: 2 } }),
    job(5, { tasks: { blocked: 1 } }),
    job(6, { tasks: { earliest_due: '2000-01-01' }, estimates: [{ state: 'draft' }] }),
  ])
  assert.deepEqual(result.priorities.map(item => item.job.id), [5, 6, 4, 3])
  assert.equal(result.active, 3)
  assert.equal(result.drafts, 1)
  assert.equal(result.ready, 1)
})
