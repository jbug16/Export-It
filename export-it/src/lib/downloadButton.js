/**
 * @param {object} params
 * @param {object[]} params.rows
 * @param {object[]} params.readyRows
 * @param {boolean} params.isRunning
 * @param {object | null} params.job
 */
export function getDownloadButtonState({ rows, readyRows, isRunning, job }) {
  const withUrl = rows.filter((r) => r.url?.trim())
  const searching = withUrl.filter((r) => r.uiStatus === 'reading' || r.uiStatus === 'searching')
  const needsReview = withUrl.filter(
    (r) =>
      r.uiStatus === 'needs_review' && !r.selectedMatch && !r.useYoutubeTitlesOnly,
  )
  const failed = withUrl.filter((r) => r.uiStatus === 'failed')

  if (isRunning || job?.status === 'running') {
    return {
      label: 'Downloading...',
      disabled: true,
      reason: null,
    }
  }

  if (job?.status === 'done') {
    const allDone = job.items?.every((i) => i.status === 'complete')
    if (allDone) {
      return {
        label: 'All done',
        disabled: true,
        reason: 'Your albums are in the Music folder.',
      }
    }
  }

  if (searching.length > 0) {
    return {
      label: 'Looking up albums...',
      disabled: true,
      reason: null,
    }
  }

  if (needsReview.length > 0) {
    const n = needsReview.length
    const anyWithoutMatches = needsReview.some((r) => !r.candidates?.length)
    return {
      label: 'Choose album matches first',
      disabled: true,
      reason: anyWithoutMatches
        ? n === 1
          ? 'No album found. Skip data sync or fix the link.'
          : `${n} albums need a match. Skip data sync if stuck.`
        : n === 1
          ? '1 album still needs a match. Tap Select below.'
          : `${n} albums still need a match. Tap Select below.`,
    }
  }

  if (failed.length > 0 && readyRows.length === 0) {
    return {
      label: 'Download All',
      disabled: true,
      reason: 'One playlist failed to load.',
    }
  }

  if (readyRows.length === 0) {
    return {
      label: 'Download All',
      disabled: true,
      reason: null,
    }
  }

  const n = readyRows.length
  return {
    label: 'Download All',
    disabled: false,
    reason: null,
  }
}
