import NodeID3 from 'node-id3'
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { padTrackNumber, sanitizeFileName, sanitizeFolderName } from './paths.js'
import { config } from '../config.js'

/**
 * @param {string} url
 * @returns {Promise<Buffer | null>}
 */
async function fetchCover(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * @param {object} params
 */
export async function tagMp3File(filePath, params) {
  const {
    title,
    artist,
    album,
    albumArtist,
    trackNumber,
    trackTotal,
    discNumber,
    year,
    coverUrl,
  } = params

  const coverBuffer = coverUrl ? await fetchCover(coverUrl) : null

  /** @type {import('node-id3').Tags} */
  const tags = {
    title,
    artist,
    album,
    performerInfo: albumArtist || artist,
    trackNumber: trackTotal ? `${trackNumber}/${trackTotal}` : String(trackNumber),
    partOfSet: discNumber ? String(discNumber) : undefined,
    year: year ? String(year) : undefined,
  }

  if (coverBuffer) {
    tags.image = {
      mime: 'image/jpeg',
      type: { id: 3, name: 'front cover' },
      description: 'Cover',
      imageBuffer: coverBuffer,
    }
  }

  const ok = NodeID3.update(tags, filePath)
  if (!ok) {
    throw new Error(`Failed to write ID3 tags to ${filePath}`)
  }
}

/**
 * @param {object} album
 * @param {object[]} spotifyTracks
 * @param {string[]} downloadedFiles - sorted by playlist order
 * @param {string} albumFolderName
 */
export async function applyAlbumMetadata(album, spotifyTracks, downloadedFiles, albumFolderName) {
  const folder = join(config.paths.music, sanitizeFolderName(albumFolderName))
  await mkdir(folder, { recursive: true })
  const sortedTracks = [...spotifyTracks].sort((a, b) => a.track_number - b.track_number)
  const year = album.release_date?.slice(0, 4)
  const albumArtist = album.artists?.map((a) => a.name).join(', ') ?? ''
  const coverUrl = album.images?.[0]?.url ?? null
  const results = []

  for (let i = 0; i < downloadedFiles.length; i++) {
    const srcPath = downloadedFiles[i]
    const spTrack = sortedTracks[i] ?? sortedTracks[sortedTracks.length - 1]
    const trackNum = spTrack?.track_number ?? i + 1
    const title = spTrack?.name ?? `Track ${trackNum}`
    const artist = spTrack?.artists?.map((a) => a.name).join(', ') || albumArtist
    const destName = `${padTrackNumber(trackNum)} - ${sanitizeFileName(title)}.mp3`
    const destPath = join(folder, destName)

    await tagMp3File(srcPath, {
      title,
      artist,
      album: album.name,
      albumArtist,
      trackNumber: trackNum,
      trackTotal: album.total_tracks,
      discNumber: spTrack?.disc_number ?? 1,
      year,
      coverUrl,
    })

    if (srcPath !== destPath) {
      await unlink(destPath).catch(() => {})
      await rename(srcPath, destPath)
    }

    results.push({ path: destPath, title, trackNumber: trackNum })
  }

  return results
}

/**
 * @param {string} playlistTitle
 * @param {string[]} videoTitles
 * @param {string[]} downloadedFiles
 */
export async function applyYoutubeTitlesMetadata(playlistTitle, videoTitles, downloadedFiles) {
  const folder = join(config.paths.music, sanitizeFolderName(playlistTitle))
  await mkdir(folder, { recursive: true })
  const trackTotal = downloadedFiles.length
  const results = []

  for (let i = 0; i < downloadedFiles.length; i++) {
    const srcPath = downloadedFiles[i]
    const trackNum = i + 1
    const title = videoTitles[i]?.trim() || `Track ${trackNum}`
    const destName = `${padTrackNumber(trackNum)} - ${sanitizeFileName(title)}.mp3`
    const destPath = join(folder, destName)

    await tagMp3File(srcPath, {
      title,
      artist: '',
      album: playlistTitle,
      albumArtist: '',
      trackNumber: trackNum,
      trackTotal,
    })

    if (srcPath !== destPath) {
      await unlink(destPath).catch(() => {})
      await rename(srcPath, destPath)
    }

    results.push({ path: destPath, title, trackNumber: trackNum })
  }

  return results
}

export { sanitizeFolderName, sanitizeFileName, padTrackNumber }
