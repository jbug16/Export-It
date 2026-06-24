import { spawn } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SPOTDL_BIN = 'spotdl'
const SEARCH_TIMEOUT_MS = 90_000
const ALBUM_LOAD_TIMEOUT_MS = 180_000
/** Typical yt-dlp flat playlist read on a Broadway cast list */
const READ_ESTIMATE_MS = 18_000
/** Pessimistic spotDL lookup (often 60–90s; can run multiple queries) */
const MATCH_ESTIMATE_MS = 150_000

export function getPreviewTimingHints() {
  return {
    readEstimateMs: READ_ESTIMATE_MS,
    matchEstimateMs: MATCH_ESTIMATE_MS,
    searchTimeoutMs: SEARCH_TIMEOUT_MS,
  }
}

let spotdlAvailable = null

export async function checkSpotdlInstalled() {
  if (spotdlAvailable !== null) return spotdlAvailable

  spotdlAvailable = await new Promise((resolve) => {
    const child = spawn(SPOTDL_BIN, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (c) => {
      out += c.toString()
    })
    child.stderr.on('data', (c) => {
      out += c.toString()
    })
    child.on('error', (err) => {
      resolve({
        installed: false,
        error:
          err.code === 'ENOENT'
            ? 'spotDL is not installed. Install with: pipx install spotdl or pip install spotdl'
            : err.message,
      })
    })
    child.on('close', (code) => {
      resolve(
        code === 0
          ? { installed: true, version: out.trim() }
          : {
              installed: false,
              error: 'spotDL is not installed. Install with: pipx install spotdl or pip install spotdl',
            },
      )
    })
  })

  return spotdlAvailable
}

function runSpotdl(args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(SPOTDL_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timer = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (c) => {
      stdout += c.toString()
    })
    child.stderr.on('data', (c) => {
      stderr += c.toString()
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr, error: err.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

function normalizeAlbumFromSongs(songs) {
  if (!Array.isArray(songs) || songs.length === 0) return null

  const first = songs[0]
  const albumId = first.album_id
  if (!albumId) return null

  return {
    spotifyAlbumId: albumId,
    name: first.album_name || first.list_name || 'Unknown Album',
    artist: first.album_artist || first.artist || first.artists?.[0] || '',
    releaseDate: first.year ? String(first.year) : null,
    totalTracks: first.tracks_count || songs.length,
    coverUrl: first.cover_url || null,
    tracks: songs.map((s) => ({
      name: s.name,
      track_number: s.track_number ?? 0,
      disc_number: s.disc_number ?? 1,
      artist: s.artist || s.artists?.[0] || '',
      artists: (s.artists || [s.artist]).filter(Boolean).map((name) => ({ name })),
    })),
    partial: songs.length < (first.tracks_count || songs.length) - 1,
  }
}

async function spotdlSaveQuery(query, timeoutMs = SEARCH_TIMEOUT_MS, albumTypeOnly = true) {
  const saveFile = join(tmpdir(), `spotdl-${randomBytes(8).toString('hex')}.spotdl`)

  try {
    const args = ['save', query, '--save-file', saveFile, '--log-level', 'ERROR']
    if (albumTypeOnly) args.push('--album-type', 'album')

    const result = await runSpotdl(args, timeoutMs)
    if (result.code !== 0) return null

    const raw = await readFile(saveFile, 'utf8')
    const songs = JSON.parse(raw)
    return normalizeAlbumFromSongs(songs)
  } catch {
    return null
  } finally {
    await unlink(saveFile).catch(() => {})
  }
}

async function spotdlSaveWithFallback(query) {
  let hit = await spotdlSaveQuery(query, SEARCH_TIMEOUT_MS, true)
  if (!hit) {
    hit = await spotdlSaveQuery(query, SEARCH_TIMEOUT_MS, false)
  }
  return hit
}

export async function getAlbumBySpotdl(albumId) {
  const url = `https://open.spotify.com/album/${albumId}`
  return spotdlSaveQuery(url, ALBUM_LOAD_TIMEOUT_MS, false)
}

/**
 * @param {string} url
 * @returns {string | null}
 */
export function parseSpotifyAlbumId(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  const match = trimmed.match(/album\/([a-zA-Z0-9]{22})/)
  return match?.[1] ?? null
}

/**
 * @param {string} spotifyAlbumUrl
 */
export async function resolveSpotifyAlbumUrl(spotifyAlbumUrl) {
  const albumId = parseSpotifyAlbumId(spotifyAlbumUrl)
  if (!albumId) return null

  const album = await getAlbumBySpotdl(albumId)
  if (!album) return null

  return {
    spotifyAlbumId: album.spotifyAlbumId,
    name: album.name,
    artist: album.artist,
    releaseDate: album.releaseDate,
    totalTracks: album.totalTracks,
    coverUrl: album.coverUrl,
    score: 1,
    source: 'manual',
  }
}

/**
 * @param {string} title
 * @returns {string[]}
 */
export function buildBestQueries(title) {
  const clean = title.trim().replace(/^[\s\-–—•]+/, '').trim()
  /** @type {string[]} */
  const queries = [clean]

  const noParens = clean.replace(/\(([^)]+)\)/g, ' $1 ').replace(/\s+/g, ' ').trim()
  if (noParens !== clean) queries.push(noParens)

  // YouTube playlists often use "(2015 Broadway Cast Recording)" while Spotify lists "(New Broadway Cast Recording)"
  const yearCastMatch = clean.match(/\((\d{4})\s+Broadway Cast Recording\)/i)
  if (yearCastMatch) {
    const newCastTitle = clean.replace(/\(\d{4}\s+Broadway Cast Recording\)/i, '(New Broadway Cast Recording)')
    if (newCastTitle !== clean) queries.unshift(newCastTitle)
  }

  if (/^(?:the\s+)?color purple\b/i.test(clean)) {
    queries.unshift('The Color Purple New Broadway Cast Recording')
    queries.push('The Color Purple Broadway cast recording')
  }

  const isCast = /broadway|cast|musical|soundtrack|obcr|original/i.test(clean)
  if (isCast) {
    const showName = clean
      .replace(/\s*:\s*the musical\b/gi, '')
      .replace(/\s*\((?:original )?(?:broadway )?cast(?: recording| album)?\)/gi, '')
      .replace(/\s*(?:original )?(?:broadway )?cast(?: recording| album)/gi, '')
      .replace(/\s*soundtrack\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (showName.length > 3) {
      if (/broadway|cast|musical/i.test(clean)) {
        queries.push(`${showName} Original Broadway Cast Recording`)
        queries.push(`${showName.replace(/:/g, '')} Original Broadway Cast Recording`)
      }
      if (/soundtrack/i.test(clean)) {
        queries.push(`${showName} soundtrack`)
        if (!/^the /i.test(showName)) {
          queries.push(`The ${showName} soundtrack`)
        }
      }
    }
  }

  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, 4)
}

/**
 * Sequential search. Stops once we have 2 albums or tried 3 queries.
 * @param {string} playlistTitle
 */
export async function searchAlbumCandidatesFast(playlistTitle) {
  const queries = buildBestQueries(playlistTitle)
  const byId = new Map()
  const maxQueries = 3

  for (const query of queries.slice(0, maxQueries)) {
    const hit = await spotdlSaveWithFallback(query)
    if (!hit?.spotifyAlbumId) continue
    if (!byId.has(hit.spotifyAlbumId)) {
      byId.set(hit.spotifyAlbumId, hit)
    }
    if (byId.size >= 2) break
  }

  return [...byId.values()]
}

export function toTaggingFormat(spotdlAlbum) {
  return {
    album: {
      name: spotdlAlbum.name,
      artists: [{ name: spotdlAlbum.artist }],
      release_date: spotdlAlbum.releaseDate,
      total_tracks: spotdlAlbum.totalTracks,
      images: spotdlAlbum.coverUrl ? [{ url: spotdlAlbum.coverUrl }] : [],
    },
    tracks: spotdlAlbum.tracks.map((t) => ({
      name: t.name,
      track_number: t.track_number,
      disc_number: t.disc_number,
      artists: t.artists?.length ? t.artists : [{ name: t.artist }],
    })),
  }
}
