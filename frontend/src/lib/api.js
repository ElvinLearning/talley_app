const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Talley-Request': '1' },
    ...options,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail = Array.isArray(data.detail) ? data.detail.map(e => e.msg).join('; ') : data.detail
    throw new Error(detail || `Request failed (${response.status})`)
  }

  if (response.status === 204) return null
  return response.json()
}

const withBody = (method, payload) => ({ method, body: JSON.stringify(payload) })

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
