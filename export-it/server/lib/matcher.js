const CAST_KEYWORDS = ['broadway', 'cast', 'original', 'recording', 'soundtrack', 'musical', 'obcr']

/**
 * @param {string} text
 */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} a
 * @param {string} b
 */
export function titleSimilarity(a, b) {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.88

  const wa = na.split(' ').filter(Boolean)
  const wb = nb.split(' ').filter(Boolean)
  const setB = new Set(wb)
  const intersection = wa.filter((w) => setB.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return union > 0 ? intersection / union : 0
}

/**
 * @param {string} a
 * @param {string} b
 */
function tracksMatch(a, b) {
  const sim = titleSimilarity(a, b)
  if (sim >= 0.55) return true

  const na = normalize(a).replace(/\breprise\b|\blive\b|\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim()
  const nb = normalize(b).replace(/\breprise\b|\blive\b|\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim()
  return titleSimilarity(na, nb) >= 0.6
}

/**
 * @param {string[]} youtubeTitles
 * @param {{ name: string }[]} spotifyTracks
 */
export function trackOverlapScore(youtubeTitles, spotifyTracks) {
  if (youtubeTitles.length === 0 || spotifyTracks.length === 0) return 0

  let matched = 0
  for (const ytTitle of youtubeTitles) {
    const found = spotifyTracks.some((track) => tracksMatch(ytTitle, track.name))
    if (found) matched++
  }

  return matched / youtubeTitles.length
}

/**
 * @param {string} text
 */
function castKeywordBonus(text) {
  const n = normalize(text)
  const hits = CAST_KEYWORDS.filter((k) => n.includes(k)).length
  return Math.min(hits * 0.04, 0.12)
}

/**
 * @param {number} a
 * @param {number} b
 */
function countSimilarity(a, b) {
  if (a === 0 || b === 0) return 0
  const diff = Math.abs(a - b)
  const max = Math.max(a, b)
  return Math.max(0, 1 - diff / max)
}

/**
 * @param {object} input
 * @param {string} input.playlistTitle
 * @param {number} input.videoCount
 * @param {string[]} input.videoTitles
 * @param {object} candidate
 * @param {string} candidate.name
 * @param {string} candidate.artist
 * @param {number} candidate.total_tracks
 * @param {{ name: string }[]} candidate.tracks
 */
export function scoreAlbumMatch(input, candidate) {
  const titleScore = titleSimilarity(input.playlistTitle, candidate.name)
  const countScore = countSimilarity(input.videoCount, candidate.total_tracks)
  const overlapScore = trackOverlapScore(input.videoTitles, candidate.tracks)
  const castBonus = Math.max(
    castKeywordBonus(input.playlistTitle),
    castKeywordBonus(candidate.name),
  )
  const artistHint = candidate.artist
    ? titleSimilarity(input.playlistTitle, candidate.artist) * 0.05
    : 0

  const score =
    titleScore * 0.32 +
    countScore * 0.18 +
    overlapScore * 0.42 +
    castBonus +
    artistHint

  return {
    score: Math.min(score, 1),
    breakdown: { titleScore, countScore, overlapScore, castBonus, artistHint },
  }
}

/**
 * @param {object} input
 * @param {object[]} candidates - albums with tracks already loaded
 */
export function rankAlbumMatches(input, candidates) {
  const scored = candidates.map((album) => {
    const { score, breakdown } = scoreAlbumMatch(input, {
      name: album.name,
      artist: album.artist ?? '',
      total_tracks: album.totalTracks,
      tracks: album.tracks,
    })

    return {
      spotifyAlbumId: album.spotifyAlbumId,
      name: album.name,
      artist: album.artist ?? '',
      releaseDate: album.releaseDate ?? null,
      totalTracks: album.totalTracks,
      coverUrl: album.coverUrl ?? null,
      score,
      breakdown,
      tracks: album.tracks.map((t) => ({ name: t.name, trackNumber: t.track_number })),
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored
}

/**
 * @param {number} score
 * @param {number} [threshold]
 */
export function isHighConfidence(score, threshold) {
  return score >= (threshold ?? 0.72)
}
