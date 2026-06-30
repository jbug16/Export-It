const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:3001'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(text || res.statusText || 'Request failed')
  }
  if (!res.ok) {
    const detail = data?.detail
    const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : data?.error
    throw new Error(msg || res.statusText || 'Request failed')
  }
  return data
}

export function fetchHealth() {
  return request('/api/health')
}

export function fetchPreview() {
  return request('/api/preview')
}

export function fetchSettings() {
  return request('/api/settings')
}

export function saveSettings(data) {
  return request('/api/settings', { method: 'PUT', body: JSON.stringify({ data }) })
}

export function fetchSpotifyMe() {
  return request('/api/spotify/me')
}

export async function startSpotifyLogin() {
  const { url } = await request('/api/spotify/login')
  window.location.href = url
}

export function spotifyLogout() {
  return request('/api/spotify/logout', { method: 'POST' })
}

export function fetchSpotifyPlaylists(limit = 50) {
  return request(`/api/spotify/playlists?limit=${limit}`)
}

export function resolveSpotifyUrl(url) {
  return request('/api/spotify/resolve', { method: 'POST', body: JSON.stringify({ url }) })
}

export async function importCsv(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/import/csv`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail || data?.error || 'CSV import failed')
  return data
}

export function startJob(payload) {
  return request('/api/jobs', { method: 'POST', body: JSON.stringify(payload) })
}

export function getJob(jobId) {
  return request(`/api/jobs/${jobId}`)
}

export function cancelJob(jobId) {
  return request(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
}

export function fetchAlternatives(track, excludeIds = []) {
  return request('/api/alternatives', {
    method: 'POST',
    body: JSON.stringify({ track, excludeIds }),
  })
}

export function downloadTrackWithMatch(jobId, rowIndex, match) {
  return request(`/api/jobs/${jobId}/tracks/${rowIndex}/download`, {
    method: 'POST',
    body: JSON.stringify({ match }),
  })
}
