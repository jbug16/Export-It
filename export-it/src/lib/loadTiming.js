const STORAGE_KEY = 'export-it-preview-timing'

/** Prefer finishing early over promising too little time. */
const OVERESTIMATE = 1.5
const READ_FLOOR_MS = 18_000
const MATCH_FLOOR_MS = 150_000

/** @type {{ readMs: number, matchMs: number } | null} */
let serverHints = null

/**
 * @param {{ readEstimateMs?: number, matchEstimateMs?: number }} hints
 */
export function setTimingHints(hints) {
  if (!hints) return
  serverHints = {
    readMs: hints.readEstimateMs ?? READ_FLOOR_MS,
    matchMs: hints.matchEstimateMs ?? MATCH_FLOOR_MS,
  }
}

function defaultEstimates() {
  return {
    readMs: serverHints?.readMs ?? READ_FLOOR_MS,
    matchMs: serverHints?.matchMs ?? MATCH_FLOOR_MS,
  }
}

/**
 * @returns {{ read: { avgMs: number, samples: number }, match: { avgMs: number, samples: number } }}
 */
function readStoredStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { read: { avgMs: 0, samples: 0 }, match: { avgMs: 0, samples: 0 } }
    const parsed = JSON.parse(raw)
    return {
      read: {
        avgMs: Number(parsed.read?.avgMs) || 0,
        samples: Number(parsed.read?.samples) || 0,
      },
      match: {
        avgMs: Number(parsed.match?.avgMs) || 0,
        samples: Number(parsed.match?.samples) || 0,
      },
    }
  } catch {
    return { read: { avgMs: 0, samples: 0 }, match: { avgMs: 0, samples: 0 } }
  }
}

function writeStoredStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // ignore quota / private mode
  }
}

function blendEstimate(storedAvg, storedSamples, fallbackMs) {
  if (storedSamples <= 0) return fallbackMs
  const weight = Math.min(storedSamples / 5, 0.75)
  const blended = Math.round(storedAvg * weight + fallbackMs * (1 - weight))
  // Never trust a fast run for future estimates — stay pessimistic.
  return Math.max(blended, fallbackMs)
}

/**
 * @returns {{ readMs: number, matchMs: number, totalMs: number }}
 */
export function getEstimates() {
  const defaults = defaultEstimates()
  const stored = readStoredStats()

  const readMs = Math.round(
    Math.max(blendEstimate(stored.read.avgMs, stored.read.samples, defaults.readMs), READ_FLOOR_MS) *
      OVERESTIMATE,
  )
  const matchMs = Math.round(
    Math.max(blendEstimate(stored.match.avgMs, stored.match.samples, defaults.matchMs), MATCH_FLOOR_MS) *
      OVERESTIMATE,
  )

  return { readMs, matchMs, totalMs: readMs + matchMs }
}

/**
 * @param {'read' | 'match'} kind
 * @param {number} durationMs
 */
export function recordPreviewDuration(kind, durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return

  const stored = readStoredStats()
  const key = kind === 'read' ? 'read' : 'match'
  const prev = stored[key]
  const pessimistic = Math.round(durationMs * 1.3)
  const avgMs = prev.samples === 0 ? pessimistic : Math.round(prev.avgMs * 0.6 + pessimistic * 0.4)

  writeStoredStats({
    ...stored,
    [key]: { avgMs, samples: prev.samples + 1 },
  })
}

function formatRemaining(ms) {
  const sec = Math.ceil(ms / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const rem = sec % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

/**
 * Progress and remaining time for the active preview phase.
 * @param {'reading' | 'searching'} phase
 * @param {number | null | undefined} phaseStartedAt
 */
export function getLoadProgress(phase, phaseStartedAt) {
  const { readMs, matchMs, totalMs } = getEstimates()
  const elapsed = phaseStartedAt ? Math.max(0, Date.now() - phaseStartedAt) : 0

  if (phase === 'reading') {
    const phaseProgress = Math.min(elapsed / readMs, 0.97)
    const overallPct = (phaseProgress * readMs) / totalMs
    const remainingMs = Math.max(0, readMs - elapsed) + matchMs

    return {
      pct: Math.round(overallPct * 100),
      remainingLabel: remainingMs > 0 ? `~${formatRemaining(remainingMs)} left` : null,
    }
  }

  const readShare = readMs / totalMs
  const phaseProgress = Math.min(elapsed / matchMs, 0.97)
  const overallPct = readShare + (phaseProgress * matchMs) / totalMs
  const remainingMs = Math.max(0, matchMs - elapsed)

  return {
    pct: Math.round(overallPct * 100),
    remainingLabel: remainingMs > 0 ? `~${formatRemaining(remainingMs)} left` : null,
  }
}
