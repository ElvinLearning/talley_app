import { daysFromToday } from './format.js'

export function briefJobs(jobs) {
  const open = jobs.filter(job => !['complete', 'on_hold'].includes(job.status))
  const priorities = open.map(job => {
    const days = daysFromToday(job.tasks?.earliest_due)
    const reason = job.tasks?.blocked ? 'Blocked work' : days !== null && days < 0 ? 'Overdue work'
      : job.tasks?.unassigned ? 'Needs an owner' : job.next.kind === 'convert' ? 'Ready to start'
        : days === 0 ? 'Due today' : null
    const rank = ['Blocked work', 'Overdue work', 'Needs an owner', 'Ready to start', 'Due today'].indexOf(reason)
    return { job, reason, rank }
  }).filter(entry => entry.reason).sort((a, b) => a.rank - b.rank || a.job.id - b.job.id)
  return {
    open, priorities,
    active: open.filter(job => job.status === 'active').length,
    drafts: open.filter(job => job.estimates.some(estimate => estimate.state === 'draft')).length,
    ready: open.filter(job => job.next.kind === 'convert').length,
    recent: [...jobs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4),
  }
}
