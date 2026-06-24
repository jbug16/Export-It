import { getCachedMatch } from '../db/index.js'
import { isHighConfidence, rankAlbumMatches, scoreAlbumMatch } from '../lib/matcher.js'
import { checkSpotdlInstalled, getAlbumBySpotdl, searchAlbumCandidatesFast } from '../lib/spotdlMeta.js'
import { extractPlaylist } from '../lib/youtube.js'
import { config } from '../config.js'

/**
 * @param {string} url
 */
export async function readPlaylist(url) {
  const extracted = await extractPlaylist(url)
  if (!extracted.ok) {
    return { ok: false, error: extracted.error }
  }

  return {
    ok: true,
    youtube: {
      url: extracted.cleanUrl,
      playlistId: extracted.playlistId,
      title: extracted.title,
      videoCount: extracted.videoCount,
      videoTitles: extracted.videos.map((v) => v.title),
      videos: extracted.videos.slice(0, 5),
    },
  }
}

/**
 * @param {object} youtube
 * @param {string} youtube.playlistId
 * @param {string} youtube.title
 * @param {number} youtube.videoCount
 * @param {string[]} youtube.videoTitles
 */
export async function matchPlaylist(youtube) {
  const cached = getCachedMatch(youtube.playlistId)
  if (cached) {
    return {
      ok: true,
      cached: true,
      selectedMatch: {
        spotifyAlbumId: cached.spotify_album_id,
        name: cached.spotify_album_name,
        artist: cached.spotify_artist,
        score: cached.confidence ?? 1,
        source: 'cache',
      },
      candidates: [],
      needsReview: false,
      status: 'ready',
    }
  }

  const spotdl = await checkSpotdlInstalled()
  if (!spotdl.installed) {
    return {
      ok: true,
      cached: false,
      selectedMatch: null,
      candidates: [],
      needsReview: true,
      status: 'needs_review',
      error: spotdl.error,
    }
  }

  const rawCandidates = await searchAlbumCandidatesFast(youtube.title)

  if (rawCandidates.length === 0) {
    return {
      ok: true,
      cached: false,
      selectedMatch: null,
      candidates: [],
      needsReview: true,
      status: 'needs_review',
      message: 'No matching albums found via spotDL',
    }
  }

  const input = {
    playlistTitle: youtube.title,
    videoCount: youtube.videoCount,
    videoTitles: youtube.videoTitles,
  }

  const candidates = rankAlbumMatches(
    input,
    rawCandidates.map((a) => ({
      spotifyAlbumId: a.spotifyAlbumId,
      name: a.name,
      artist: a.artist,
      releaseDate: a.releaseDate,
      totalTracks: a.totalTracks,
      coverUrl: a.coverUrl,
      tracks: a.tracks,
    })),
  )
    .map((c) => {
      const raw = rawCandidates.find((r) => r.spotifyAlbumId === c.spotifyAlbumId)
      if (raw?.partial && raw.tracks.length < 5) {
        const { breakdown } = scoreAlbumMatch(input, {
          name: c.name,
          artist: c.artist,
          total_tracks: c.totalTracks,
          tracks: c.tracks,
        })
        const partialScore = Math.min(
          breakdown.titleScore * 0.5 +
            breakdown.countScore * 0.35 +
            breakdown.castBonus +
            breakdown.artistHint,
          1,
        )
        return { ...c, score: partialScore }
      }
      return c
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const best = candidates[0]
  const high = best && isHighConfidence(best.score, config.matchConfidenceThreshold)

  return {
    ok: true,
    cached: false,
    selectedMatch: high
      ? {
          spotifyAlbumId: best.spotifyAlbumId,
          name: best.name,
          artist: best.artist,
          releaseDate: best.releaseDate,
          totalTracks: best.totalTracks,
          coverUrl: best.coverUrl,
          score: best.score,
          source: 'auto',
        }
      : null,
    candidates,
    needsReview: !high,
    status: high ? 'ready' : 'needs_review',
  }
}

/** @deprecated use readPlaylist + matchPlaylist */
export async function previewPlaylist(url) {
  const read = await readPlaylist(url)
  if (!read.ok) return read
  const match = await matchPlaylist(read.youtube)
  return { ok: true, youtube: read.youtube, ...match }
}

export async function loadAlbumForDownload(albumId) {
  const album = await getAlbumBySpotdl(albumId)
  if (!album) throw new Error('Could not load album metadata from spotDL')
  return album
}
