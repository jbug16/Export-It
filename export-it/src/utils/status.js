const CONFIDENCE_MIN = 0.6

export function isSpotifyUrl(url) {
  return /open\.spotify\.com\/(album|playlist|track)\/[a-zA-Z0-9]+/.test((url || '').trim())
}

export function normalizeSpotifyUrl(url) {
  const match = (url || '').trim().match(/open\.spotify\.com\/(album|playlist|track)\/([a-zA-Z0-9]+)/)
  return match ? `${match[1]}:${match[2]}` : (url || '').trim().toLowerCase()
}

export function extractFilename(status) {
  if (!status) return null
  const arrow = status.match(/→\s*(.+)$/)
  if (arrow) return arrow[1].trim()
  if (status.startsWith('Low confidence → ')) return status.slice('Low confidence → '.length).trim()
  return null
}

export function getRowBadge(row, hasJob) {
  if (!hasJob) return { label: 'Queued', variant: 'queued' }

  if (row?.downloaded) {
    return {
      label: 'Done',
      variant: 'done',
      filename: row.filePath ? row.filePath.split(/[/\\]/).pop() : extractFilename(row?.status),
    }
  }
  if (row?.error || (row?.status && row.status.startsWith('Fail'))) {
    return {
      label: 'Failed',
      variant: 'failed',
      detail: row.error || row.status?.replace(/^Fail:\s*/, ''),
    }
  }
  if (row?.skipped) {
    return { label: 'Skipped', variant: 'skipped', detail: row.status }
  }
  if (row?.lowConfidence || (row?.confidence > 0 && row.confidence < CONFIDENCE_MIN)) {
    return {
      label: 'Needs Review',
      variant: 'review',
      confidence: row.confidence,
    }
  }
  if (row?.status?.includes('Downloading') || row?.status?.includes('Tagging')) {
    return { label: 'Downloading', variant: 'downloading' }
  }
  if (row?.status?.startsWith('Done') || row?.status?.startsWith('Low confidence')) {
    return {
      label: row?.status?.startsWith('Low confidence') ? 'Needs Review' : 'Done',
      variant: row?.status?.startsWith('Low confidence') ? 'review' : 'done',
      filename: extractFilename(row?.status),
      confidence: row?.confidence,
    }
  }
  return { label: 'Queued', variant: 'queued' }
}

export function getTrackListIconStatus(row, hasJob) {
  if (!hasJob || !row) return null
  const badge = getRowBadge(row, true)
  if (badge.variant === 'downloading') return 'downloading'
  if (badge.variant === 'done') return 'done'
  if (badge.variant === 'failed') return 'failed'
  return null
}

export function getStatusText(row, hasJob) {
  const badge = getRowBadge(row, hasJob)
  if (!hasJob) return 'Queued'
  if (badge.variant === 'downloading') {
    return row?.status?.includes('Tagging') ? 'Tagging…' : 'Downloading…'
  }
  if (badge.variant === 'review') return 'Needs review'
  if (badge.variant === 'done') return 'Done'
  if (badge.variant === 'failed') return 'Failed'
  if (badge.variant === 'skipped') return 'Skipped'
  return 'Queued'
}

export function countIssues(rows) {
  if (!rows?.length) return 0
  return rows.filter((row) => {
    const badge = getRowBadge(row, true)
    return badge.variant === 'failed' || badge.variant === 'review' || badge.variant === 'skipped'
  }).length
}

export function formatTypeLabel(type) {
  if (type === 'album') return 'Album'
  if (type === 'playlist') return 'Playlist'
  if (type === 'track') return 'Track'
  if (type === 'csv') return 'CSV'
  return type || 'Source'
}

export function shortenPath(path, maxLen = 48) {
  if (!path || path.length <= maxLen) return path
  const parts = path.split(/[/\\]/)
  if (parts.length <= 2) return `…${path.slice(-maxLen + 1)}`
  return `${parts[0]}/…/${parts[parts.length - 1]}`
}

export function formatFolderDisplay(path) {
  if (!path) return 'Not set'
  const parts = path.split(/[/\\]/).filter(Boolean)
  if (!parts.length) return path
  const last = parts[parts.length - 1]
  const known = ['Desktop', 'Documents', 'Downloads', 'Music']
  if (known.includes(last)) return last
  if (parts.length >= 2 && known.includes(parts[parts.length - 2])) {
    return `${parts[parts.length - 2]}/${last}`
  }
  return last
}
