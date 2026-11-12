// Task statuses (field work).
export const STATUS_ORDER = ['not_started', 'in_progress', 'blocked', 'review', 'done']

export const STATUS = {
  not_started: { label: 'Not started', bg: '#ECE7E0', fg: '#4F4943' },
  in_progress: { label: 'In progress', bg: '#F7E5BF', fg: '#6F4204' },
  blocked: { label: 'Blocked', bg: '#F6DAD5', fg: '#8C2C1B' },
  review: { label: 'Review', bg: '#DEE7F3', fg: '#27456D' },
  done: { label: 'Done', bg: '#D8E8DE', fg: '#1F5239' },
}

export const statusMeta = (status) => STATUS[status] || STATUS.not_started

// Job stages (office workflow), in the order a job moves through them.
export const STAGE_ORDER = ['lead', 'estimating', 'approved', 'active', 'on_hold', 'complete']

export const STAGE = {
  lead: { label: 'Lead', bg: '#ECE7E0', fg: '#4F4943', dot: '#8B8279' },
  estimating: { label: 'Estimating', bg: '#F7E5BF', fg: '#6F4204', dot: '#C98A12' },
  approved: { label: 'Approved', bg: '#DEE7F3', fg: '#27456D', dot: '#3E6BA8' },
  active: { label: 'Active', bg: '#D8E8DE', fg: '#1F5239', dot: '#2E7D5B' },
  on_hold: { label: 'On hold', bg: '#F3E1D3', fg: '#7A4016', dot: '#B4672B' },
  complete: { label: 'Complete', bg: '#E7E4E1', fg: '#4A4543', dot: '#655F5D' },
}

export const stageMeta = (stage) => STAGE[stage] || STAGE.lead
