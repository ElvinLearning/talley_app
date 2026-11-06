export const STATUS_ORDER = ['not_started', 'in_progress', 'blocked', 'review', 'done']

export const STATUS = {
  not_started: { label: 'Not Started', bg: '#ECE7E0', fg: '#5B544C' },
  in_progress: { label: 'In Progress', bg: '#F7E5BF', fg: '#7A4A05' },
  blocked: { label: 'Blocked', bg: '#F6DAD5', fg: '#8C2C1B' },
  review: { label: 'Review', bg: '#DEE7F3', fg: '#2E4C74' },
  done: { label: 'Done', bg: '#D8E8DE', fg: '#20573C' },
}

export const statusMeta = (status) => STATUS[status] || STATUS.not_started
