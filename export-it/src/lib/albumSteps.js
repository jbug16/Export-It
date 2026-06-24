/**
 * @typedef {'pending' | 'loading' | 'complete' | 'needs_attention' | 'failed' | 'skipped'} StepState
 */

/**
 * @param {object} row
 * @param {object | null | undefined} jobItem
 */
export function getAlbumSteps(row, jobItem) {
  const status = row.uiStatus ?? 'empty'
  const hasUrl = Boolean(row.url?.trim())
  const useYoutube = row.useYoutubeTitlesOnly
  const hasMatch = Boolean(row.selectedMatch) || useYoutube
  const needsPick =
    status === 'needs_review' && !row.selectedMatch && !useYoutube && row.candidates?.length > 0

  /** @type {StepState} */
  let read = 'pending'
  /** @type {StepState} */
  let find = 'pending'
  /** @type {StepState} */
  let pick = 'skipped'
  /** @type {StepState} */
  let ready = 'pending'
  /** @type {StepState} */
  let download = 'pending'
  /** @type {StepState} */
  let details = 'pending'
  /** @type {StepState} */
  let done = 'pending'

  if (!hasUrl) {
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (status === 'failed') {
    read = 'failed'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (status === 'reading') {
    read = 'loading'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  read = 'complete'

  if (status === 'searching') {
    find = 'loading'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (hasUrl && status !== 'reading') {
    find = status === 'failed' ? 'failed' : 'complete'
  }

  if (needsPick) {
    pick = 'needs_attention'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (hasMatch && (status === 'ready' || status === 'needs_review')) {
    pick = useYoutube ? 'skipped' : 'complete'
    ready = 'complete'
  }

  if (!jobItem) {
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (jobItem.status === 'queued' || jobItem.status === 'ready') {
    download = 'loading'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (jobItem.status === 'downloading') {
    download = 'loading'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (jobItem.status === 'tagging') {
    download = 'complete'
    details = 'loading'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (jobItem.status === 'complete') {
    download = 'complete'
    details = 'complete'
    done = 'complete'
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  if (jobItem.status === 'failed') {
    if (jobItem.downloadCurrent > 0) {
      download = 'failed'
    } else {
      download = 'failed'
    }
    return buildSteps(read, find, pick, ready, download, details, done)
  }

  return buildSteps(read, find, pick, ready, download, details, done)
}

/**
 * @param {StepState} read
 * @param {StepState} find
 * @param {StepState} pick
 * @param {StepState} ready
 * @param {StepState} download
 * @param {StepState} details
 * @param {StepState} done
 */
function buildSteps(read, find, pick, ready, download, details, done) {
  const steps = [
    { id: 'read', label: 'Reading playlist', state: read },
    { id: 'find', label: 'Finding album info', state: find },
  ]

  if (pick !== 'skipped') {
    steps.push({ id: 'pick', label: 'Waiting for album choice', state: pick })
  }

  steps.push(
    { id: 'ready', label: 'Ready to download', state: ready },
    { id: 'download', label: 'Downloading songs', state: download },
    { id: 'details', label: 'Adding album details', state: details },
    { id: 'done', label: 'Done', state: done },
  )

  return steps.filter((s) => {
    if (s.state !== 'pending') return true
    if (['read', 'find', 'pick', 'ready'].includes(s.id)) {
      const readyOrLater =
        ready === 'complete' ||
        download !== 'pending' ||
        details !== 'pending' ||
        done !== 'pending'
      if (readyOrLater) return false
      return true
    }
    return false
  })
}

/**
 * @param {object} row
 * @param {object | null | undefined} jobItem
 */
export function getStatusPill(row, jobItem) {
  if (jobItem?.status === 'complete') return { text: 'Done', tone: 'done' }
  if (jobItem?.status === 'failed') return { text: 'Failed', tone: 'failed' }
  if (jobItem?.status === 'downloading') return { text: 'Downloading', tone: 'active' }
  if (jobItem?.status === 'tagging') return { text: 'Adding details', tone: 'active' }
  if (jobItem?.status === 'queued' || jobItem?.status === 'ready') {
    return { text: 'Queued', tone: 'active' }
  }

  const status = row.uiStatus ?? 'empty'
  if (status === 'reading') return { text: 'Reading', tone: 'active' }
  if (status === 'searching') return { text: 'Finding info', tone: 'active' }
  if (status === 'needs_review' && !row.selectedMatch && !row.useYoutubeTitlesOnly) {
    return { text: 'Pick album', tone: 'attention' }
  }
  if (status === 'ready') return { text: 'Ready', tone: 'ready' }
  if (status === 'failed') return { text: 'Failed', tone: 'failed' }
  return null
}

/**
 * @param {object} row
 * @param {object | null | undefined} jobItem
 */
export function getCurrentStepLabel(row, jobItem) {
  const steps = getAlbumSteps(row, jobItem)
  const active =
    steps.find((s) => s.state === 'loading') ||
    steps.find((s) => s.state === 'needs_attention') ||
    steps.find((s) => s.state === 'failed')
  if (active) {
    if (active.id === 'find') return 'Finding album info from Spotify...'
    if (active.id === 'pick') return 'Pick the correct album'
    if (active.id === 'download') return 'Downloading'
    if (active.id === 'details') return 'Adding details'
    if (active.state === 'failed') return 'Something went wrong'
    return `${active.label}...`
  }
  if (jobItem?.status === 'complete') return 'Complete'
  if (row.uiStatus === 'ready') return 'Ready to download'
  return null
}
