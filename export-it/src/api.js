export async function fetchHealth() {
  const res = await fetch('/api/health')
  return res.ok ? res.json() : null
}

export async function readPlaylist(url, signal) {
  const res = await fetch('/api/playlists/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not read playlist')
  return data
}

export async function matchPlaylist(youtube, signal) {
  const res = await fetch('/api/playlists/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ youtube }),
    signal,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Metadata match failed')
  return data
}

export async function resolveSpotifyAlbum(spotifyUrl, signal) {
  const res = await fetch('/api/playlists/spotify-album', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: spotifyUrl }),
    signal,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not load Spotify album')
  return data.match
}

export async function startJob(items, mode = 'safe') {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, mode }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not start job')
  return data
}

export async function getJob(jobId) {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`)
  if (!res.ok) throw new Error('Could not fetch job status')
  return res.json()
}
