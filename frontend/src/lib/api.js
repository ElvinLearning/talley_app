const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    // FastAPI validation errors arrive as a list of { loc, msg }; kept so forms
    // can point at the exact field.
    this.detail = detail
  }
}

export const SIGNED_OUT_EVENT = 'talley:signed-out'

export async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Talley-Request': '1' },
      ...options,
    })
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail = data.detail
    const message = Array.isArray(detail) ? detail.map((entry) => entry.msg).join('; ') : detail
    // A session that ended mid-task: let the app ask for sign-in without
    // throwing away what is on screen.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    }
    throw new ApiError(
      message ||
        (response.status >= 500
          ? 'The server did not respond. Try again in a moment.'
          : `Request failed (${response.status})`),
      response.status,
      detail
    )
  }

  if (response.status === 204) return null
  return response.json()
}

const withBody = (method, payload) => ({ method, body: JSON.stringify(payload) })

export const send = (path, method, data) =>
  request(path, { method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })

export const api = {
  boards: () => request('/boards'),
  board: (id) => request(`/boards/${id}`),
  createBoard: (payload) => request('/boards', withBody('POST', payload)),
  updateBoard: (id, payload) => request(`/boards/${id}`, withBody('PATCH', payload)),
  deleteBoard: (id) => request(`/boards/${id}`, { method: 'DELETE' }),
  addGroup: (boardId, payload) => request(`/boards/${boardId}/groups`, withBody('POST', payload)),
  addItem: (groupId, payload) => request(`/groups/${groupId}/items`, withBody('POST', payload)),
  updateItem: (id, payload) => request(`/items/${id}`, withBody('PATCH', payload)),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  team: () => request('/team'),
  overview: () => request('/overview'),
}
