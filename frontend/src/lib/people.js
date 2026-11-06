const PALETTE = ['#6D2431', '#4A6FA5', '#A8552F', '#3F5B4A', '#5B4B6E', '#8A3444', '#7A6A4F']

export function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function colorFor(name = '') {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 9973
  }
  return PALETTE[hash % PALETTE.length]
}
