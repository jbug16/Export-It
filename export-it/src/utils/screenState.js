import { countIssues } from './status.js'

export function getScreenState({ detectedItems, job, isRunning, reviewingIssues }) {
  if (isRunning) return 'downloading'

  const jobDone = job && ['done', 'failed', 'cancelled'].includes(job.status)
  const issues = job ? countIssues(job.rows) : 0

  if (jobDone) {
    if (issues > 0) {
      return reviewingIssues ? 'error' : 'doneIssues'
    }
    if (job.status === 'done') return 'done'
    if (detectedItems.length > 1) return 'multiDetected'
    if (detectedItems.length === 1) return 'detected'
    return 'empty'
  }

  if (detectedItems.length > 1) return 'multiDetected'
  if (detectedItems.length === 1) return 'detected'
  return 'empty'
}

export function buildDownloadSummaryFields(settings, outDir, itemCount, songCount) {
  const itemWord = itemCount === 1 ? 'item' : 'items'
  const songWord = songCount === 1 ? 'song' : 'songs'
  return [
    { label: 'Items', value: `${itemCount} ${itemWord}` },
    { label: 'Songs', value: `${songCount} ${songWord}` },
    { label: 'Format', value: (settings.fmt || 'mp3').toUpperCase() },
    { label: 'Artwork', value: settings.embed_art !== false ? 'Included' : 'Off' },
    { label: 'Save location', value: formatSaveLocation(outDir) },
  ]
}

export function formatSaveLocation(path) {
  if (!path) return 'Not set'
  const parts = path.split(/[/\\]/).filter(Boolean)
  if (!parts.length) return path
  const last = parts[parts.length - 1]
  const known = ['Desktop', 'Documents', 'Downloads', 'Music']
  if (known.includes(last)) return last
  return last
}

export function formatSavedPath(outDir, itemName) {
  const base = formatSaveLocation(outDir)
  if (!itemName) return base
  return `${base} / Export-It / ${itemName}`
}

export function getItemDownloadStatus(item, jobRows, trackOffset) {
  if (!jobRows?.length || !item?.tracks?.length) return null

  const statuses = item.tracks.map((_, i) => {
    const row = jobRows[trackOffset + i]
    if (!row) return 'queued'
    if (row.downloaded) return 'done'
    if (row.error || row.status?.startsWith('Fail')) return 'failed'
    if (row.status?.includes('Downloading') || row.status?.includes('Tagging')) return 'downloading'
    return 'queued'
  })

  if (statuses.some((s) => s === 'downloading')) return 'downloading'
  if (statuses.every((s) => s === 'done')) return 'done'
  if (statuses.some((s) => s === 'failed')) return 'failed'
  if (statuses.some((s) => s === 'done')) return 'downloading'
  return 'queued'
}

export function getItemStatusText(item, jobRows, trackOffset) {
  if (!jobRows?.length || !item?.tracks?.length) return null

  const status = getItemDownloadStatus(item, jobRows, trackOffset)
  if (!status || status === 'queued') return null

  const trackTotal = item.tracks.length
  let doneInItem = 0
  for (let t = 0; t < trackTotal; t++) {
    if (jobRows[trackOffset + t]?.downloaded) doneInItem++
  }

  if (status === 'downloading') return `Downloading ${doneInItem}/${trackTotal}`
  if (status === 'done') return 'Done'
  if (status === 'failed') return 'Failed'
  return null
}

function getProgressItemSubtitle(item) {
  if (!item) return null
  if (item.type === 'track') {
    const album = item.tracks?.[0]?.album
    if (album && album !== item.name) return album
    return item.owner || null
  }
  return item.owner || null
}

export function findDownloadProgress(detectedItems, itemTrackOffsets, jobRows) {
  if (!jobRows?.length || !detectedItems.length) return null

  const overallDownloaded = jobRows.filter((r) => r.downloaded).length
  const overallTotal = jobRows.length

  for (let i = 0; i < detectedItems.length; i++) {
    const item = detectedItems[i]
    const offset = itemTrackOffsets.get(item.id) ?? 0
    const trackTotal = item.tracks.length
    let doneInItem = 0
    let activeTrackIndex = null

    for (let t = 0; t < trackTotal; t++) {
      const row = jobRows[offset + t]
      if (!row) continue
      if (row.downloaded) doneInItem++
      if (row.status?.includes('Downloading') || row.status?.includes('Tagging')) {
        activeTrackIndex = t + 1
      }
    }

    if (doneInItem < trackTotal) {
      return {
        itemIndex: i + 1,
        itemCount: detectedItems.length,
        itemName: item.name,
        itemSubtitle: getProgressItemSubtitle(item),
        coverUrl: item.coverUrl,
        trackIndex: activeTrackIndex ?? Math.min(doneInItem + 1, trackTotal),
        trackTotal,
        overallDownloaded,
        overallTotal,
      }
    }
  }

  const lastItem = detectedItems[detectedItems.length - 1]
  return {
    itemIndex: detectedItems.length,
    itemCount: detectedItems.length,
    itemName: lastItem?.name || '',
    itemSubtitle: getProgressItemSubtitle(lastItem),
    coverUrl: lastItem?.coverUrl,
    trackIndex: lastItem?.tracks?.length || 0,
    trackTotal: lastItem?.tracks?.length || 0,
    overallDownloaded,
    overallTotal,
  }
}

export function countDownloaded(rows) {
  if (!rows?.length) return 0
  return rows.filter((r) => r.downloaded).length
}

export function findCurrentTrack(rows, tracks) {
  if (!rows?.length) return null
  for (const row of rows) {
    if (row.status?.includes('Downloading') || row.status?.includes('Tagging')) {
      const t = tracks[row.index]
      return t?.title || row.title
    }
  }
  return null
}
