import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config.js'
import { saveMatch } from '../db/index.js'
import { applyAlbumMetadata, applyYoutubeTitlesMetadata, sanitizeFolderName } from '../lib/metadata.js'
import { toTaggingFormat } from '../lib/spotdlMeta.js'
import { loadAlbumForDownload } from '../services/preview.js'
import { runYtDlp } from '../lib/ytdlp.js'
import { parseYoutubeUrl } from '../lib/youtubeLinks.js'

/** @type {Map<string, JobRecord>} */
export const jobs = new Map()

function summarizeYtDlpError(stderr) {
  const text = stderr || ''
  if (/ffprobe and ffmpeg not found|ffmpeg-location .* does not exist/i.test(text)) {
    return 'ffmpeg not found. Install with: brew install ffmpeg, then restart the app.'
  }
  if (/Video unavailable/i.test(text)) {
    return 'Some playlist videos are unavailable on YouTube. Skipped where possible — try again or remove dead entries from the playlist.'
  }
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('ERROR:'))
  return lines[lines.length - 1]?.replace(/^ERROR:\s*/, '') || 'Download failed'
}

function buildYtDlpArgs(outputTemplate, url) {
  /** @type {string[]} */
  const args = [
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--no-update',
    '--no-playlist-reverse',
    '--ignore-errors',
    '--retries',
    '5',
    '--fragment-retries',
    '5',
    '-o',
    outputTemplate,
  ]

  if (config.ffmpegLocation) {
    args.push('--ffmpeg-location', config.ffmpegLocation)
  }

  args.push(url)
  return args
}

/**
 * @typedef {Object} JobItem
 * @property {string} id
 * @property {string} youtubeUrl
 * @property {string} youtubePlaylistId
 * @property {string} playlistTitle
 * @property {string | null} spotifyAlbumId
 * @property {string | null} spotifyAlbumName
 * @property {string | null} spotifyArtist
 * @property {'queued'|'reading'|'searching'|'ready'|'downloading'|'tagging'|'complete'|'failed'|'needs_review'} status
 * @property {string} message
 * @property {number} downloadCurrent
 * @property {number} downloadTotal
 * @property {string | null} error
 * @property {string | null} musicFolder
 */

/**
 * @typedef {Object} JobRecord
 * @property {string} id
 * @property {'queued'|'running'|'done'|'failed'} status
 * @property {'safe'|'fast'} mode
 * @property {JobItem[]} items
 * @property {string} createdAt
 */

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * @param {JobRecord} job
 */
export function serializeJob(job) {
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    items: job.items.map((item) => ({ ...item })),
    createdAt: job.createdAt,
    musicDir: 'Music',
  }
}

/**
 * @param {{ youtubeUrl: string, playlistTitle: string, youtubePlaylistId: string, spotifyAlbumId?: string | null, spotifyAlbumName?: string, spotifyArtist?: string, confidence?: number, useYoutubeTitlesOnly?: boolean, videoTitles?: string[] }} params
 */
export async function processAlbumItem(params) {
  const parsed = parseYoutubeUrl(params.youtubeUrl)
  if (!parsed.valid) throw new Error('Invalid YouTube URL')

  const useYoutubeOnly = !params.spotifyAlbumId && params.useYoutubeTitlesOnly

  const itemId = createId('item')
  /** @type {JobItem} */
  const item = {
    id: itemId,
    youtubeUrl: parsed.cleanUrl,
    youtubePlaylistId: params.youtubePlaylistId,
    playlistTitle: params.playlistTitle,
    spotifyAlbumId: params.spotifyAlbumId ?? null,
    spotifyAlbumName: params.spotifyAlbumName ?? null,
    spotifyArtist: params.spotifyArtist ?? null,
    status: 'downloading',
    message: 'Starting download…',
    downloadCurrent: 0,
    downloadTotal: 0,
    error: null,
    musicFolder: null,
  }

  const tempDir = join(config.paths.temp, itemId)
  await mkdir(tempDir, { recursive: true })
  await mkdir(config.paths.music, { recursive: true })

  try {
    if (!config.ffmpegLocation) {
      throw new Error('ffmpeg not found. Install with: brew install ffmpeg, then restart the app.')
    }

    let album
    let tracks
    let albumFolderName

    if (useYoutubeOnly) {
      albumFolderName = params.playlistTitle
      item.downloadTotal = params.videoTitles?.length ?? 0
    } else {
      const spotdlAlbum = await loadAlbumForDownload(params.spotifyAlbumId)
      ;({ album, tracks } = toTaggingFormat(spotdlAlbum))
      albumFolderName = album.name
      item.spotifyAlbumName = album.name
      item.spotifyArtist = album.artists?.map((a) => a.name).join(', ') ?? null
      item.downloadTotal = album.total_tracks
    }

    const outputTemplate = join(tempDir, '%(playlist_index)02d.%(ext)s')

    let attempt = 0
    let lastError = ''
    while (attempt < 2) {
      attempt++
      item.message = attempt > 1 ? 'Retrying download…' : 'Downloading audio…'

      const result = await runYtDlp(buildYtDlpArgs(outputTemplate, parsed.cleanUrl), {
        timeoutMs: 3_600_000,
      })

      const files = (await readdir(tempDir))
        .filter((f) => f.endsWith('.mp3'))
        .sort()
        .map((f) => join(tempDir, f))

      if (files.length > 0) break

      lastError = summarizeYtDlpError(result.stderr)
      if (attempt >= 2) throw new Error(lastError)
    }

    const files = (await readdir(tempDir))
      .filter((f) => f.endsWith('.mp3'))
      .sort()
      .map((f) => join(tempDir, f))

    if (files.length === 0) {
      throw new Error(lastError || 'No audio files were downloaded')
    }

    item.downloadCurrent = files.length
    item.message = `Downloaded ${files.length} tracks`

    item.status = 'tagging'
    item.message = useYoutubeOnly ? 'Applying YouTube titles…' : 'Applying album metadata…'

    const tagged = useYoutubeOnly
      ? await applyYoutubeTitlesMetadata(
          params.playlistTitle,
          params.videoTitles ?? [],
          files,
        )
      : await applyAlbumMetadata(album, tracks, files, albumFolderName)

    const outputAlbumName = useYoutubeOnly ? params.playlistTitle : album.name
    item.musicFolder = join('Music', sanitizeFolderName(outputAlbumName))

    if (!useYoutubeOnly && params.spotifyAlbumId) {
      saveMatch({
        youtube_playlist_id: params.youtubePlaylistId,
        youtube_url: parsed.cleanUrl,
        spotify_album_id: params.spotifyAlbumId,
        spotify_album_name: album.name,
        spotify_artist: item.spotifyArtist,
        confidence: params.confidence ?? null,
      })
    }

    item.status = 'complete'
    item.message = 'Complete'
  } catch (err) {
    item.status = 'failed'
    item.error = err.message || 'Processing failed'
    item.message = item.error
    console.error(`[Processor] Failed ${params.playlistTitle}:`, err)
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }

  return item
}

/**
 * @param {string} jobId
 * @param {JobItem[]} items
 */
export async function runJob(jobId, items) {
  const job = jobs.get(jobId)
  if (!job) return

  job.status = 'running'

  for (const pending of items) {
    const live = job.items.find((i) => i.id === pending.id)
    if (!live || live.status === 'needs_review') continue

    live.status = 'downloading'
    live.message = 'Downloading…'

    const result = await processAlbumItem({
      youtubeUrl: live.youtubeUrl,
      youtubePlaylistId: live.youtubePlaylistId,
      playlistTitle: live.playlistTitle,
      spotifyAlbumId: live.spotifyAlbumId,
      spotifyAlbumName: live.spotifyAlbumName ?? undefined,
      spotifyArtist: live.spotifyArtist ?? undefined,
      useYoutubeTitlesOnly: live.useYoutubeTitlesOnly,
      videoTitles: live.videoTitles,
    })

    Object.assign(live, {
      status: result.status,
      message: result.message,
      downloadCurrent: result.downloadCurrent,
      downloadTotal: result.downloadTotal,
      error: result.error,
      musicFolder: result.musicFolder,
      spotifyAlbumName: result.spotifyAlbumName,
      spotifyArtist: result.spotifyArtist,
    })
  }

  const allFailed = job.items.every((i) => i.status === 'failed' || i.status === 'needs_review')
  const anyComplete = job.items.some((i) => i.status === 'complete')
  job.status = anyComplete ? 'done' : allFailed ? 'failed' : 'done'
}
