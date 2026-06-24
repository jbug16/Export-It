/**
 * @param {number | undefined} score
 * @param {string | undefined} source
 */
export function matchQualityLabel(score, source) {
  if (source === 'cache') return 'Saved match'
  if (!score) return null
  if (score >= 0.85) return 'Best match'
  if (score >= 0.7) return 'Good match'
  return 'Possible match'
}

/**
 * @param {number} count
 */
export function songCountLabel(count) {
  if (!count) return null
  return count === 1 ? '1 song' : `${count} songs`
}

/**
 * @param {object} candidate
 * @param {number} [playlistSongCount]
 */
export function candidateFactsLine(candidate, playlistSongCount) {
  const parts = []
  if (candidate.artist) parts.push(candidate.artist)
  const year = candidate.releaseDate?.slice(0, 4)
  if (year && /^\d{4}$/.test(year)) parts.push(year)
  if (candidate.totalTracks) {
    parts.push(`${candidate.totalTracks} ${candidate.totalTracks === 1 ? 'track' : 'tracks'}`)
  } else if (playlistSongCount) {
    parts.push(`${playlistSongCount} songs in your playlist`)
  }
  return parts.join(' · ')
}

/**
 * Short hint explaining how a Spotify candidate differs from the YouTube playlist.
 * @param {object} candidate
 * @param {number} [playlistSongCount]
 */
export function candidateCompareHint(candidate, playlistSongCount) {
  const hints = []

  if (candidate.totalTracks && playlistSongCount) {
    const diff = playlistSongCount - candidate.totalTracks
    if (diff > 2) hints.push(`${diff} fewer tracks than your playlist`)
    else if (diff < -2) hints.push(`${Math.abs(diff)} more tracks than your playlist`)
  }

  const overlap = candidate.breakdown?.overlapScore
  if (overlap != null) {
    const pct = Math.round(overlap * 100)
    if (pct >= 80) hints.push(`${pct}% of song titles match`)
    else if (pct >= 45) hints.push(`${pct}% song title match — may be a different version`)
    else hints.push(`Only ${pct}% song titles match — likely not the same album`)
  }

  return hints.join(' · ')
}

/**
 * @param {string} s
 */
export function normalizeTitleForCompare(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * True when the Spotify album name is essentially the same as the YouTube playlist title.
 * @param {string} playlistTitle
 * @param {string} albumName
 */
export function matchMatchesPlaylist(playlistTitle, albumName) {
  const a = normalizeTitleForCompare(playlistTitle)
  const b = normalizeTitleForCompare(albumName)
  if (!a || !b) return false
  if (a === b) return true

  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.72) return true

  return false
}
