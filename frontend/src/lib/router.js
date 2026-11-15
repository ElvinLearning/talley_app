// A small hash router: real URLs for every screen so refresh, the browser's
// back button and the phone's back gesture all behave as people expect.
// No dependency; the whole app is a handful of routes.
import { useSyncExternalStore } from 'react'

const read = () => window.location.hash.replace(/^#/, '') || '/'

let current = read()
let index = window.history.state?.i ?? 0
let guard = null
const listeners = new Set()

if (window.history.state?.i == null) window.history.replaceState({ i: index }, '')

const notify = () => listeners.forEach((listener) => listener())

window.addEventListener('hashchange', () => {
  const next = read()
  if (next === current) return
  const position = window.history.state?.i
  if (guard && !guard()) {
    // Put the address bar back without losing the page the person is on.
    if (position == null) window.history.back()
    else window.history.go(index - position)
    return
  }
  if (position == null) {
    index += 1
    window.history.replaceState({ i: index }, '')
  } else {
    index = position
  }
  current = next
  notify()
})

/** Go to a path such as `/jobs/12`. Returns false if an unsaved-changes guard cancelled it. */
export function navigate(path, { replace = false } = {}) {
  if (path === current) return true
  if (guard && !guard()) return false
  current = path
  if (replace) {
    window.history.replaceState({ i: index }, '', `#${path}`)
  } else {
    index += 1
    window.history.pushState({ i: index }, '', `#${path}`)
  }
  notify()
  return true
}

/** While set, leaving the current screen asks `fn()` first (return true to allow). */
export function setLeaveGuard(fn) {
  guard = fn
}

export const href = (path) => `#${path}`

export function usePath() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}
