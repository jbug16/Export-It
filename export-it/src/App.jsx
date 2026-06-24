import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchHealth, getJob, matchPlaylist, readPlaylist, resolveSpotifyAlbum, startJob } from './api.js'
import AlbumCard from './components/AlbumCard.jsx'
import StepNav, { getCurrentStep } from './components/StepNav.jsx'
import { getDownloadButtonState } from './lib/downloadButton.js'
import { friendlyError } from './lib/errorMessages.js'
import { recordPreviewDuration, setTimingHints } from './lib/loadTiming.js'
import './App.css'

let nextRowId = 1

function createRow(url = '') {
  return {
    id: nextRowId++,
    url,
    uiStatus: url ? 'reading' : 'empty',
    valid: false,
    playlistTitle: '',
    videoCount: 0,
    videoTitles: [],
    youtubePlaylistId: '',
    cleanUrl: '',
    selectedMatch: null,
    candidates: [],
    needsReview: false,
    useYoutubeTitlesOnly: false,
    error: null,
    phaseStartedAt: null,
  }
}

export default function App() {
  const [rows, setRows] = useState(() => [createRow()])
  const [job, setJob] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const previewTimers = useRef(new Map())
  const previewAbort = useRef(new Map())
  const addedRowForUrl = useRef(new Set())

  useEffect(() => {
    fetchHealth().then((health) => {
      if (health?.timing) setTimingHints(health.timing)
      const issues = []
      if (health?.ytdlp?.installed === false) issues.push(health.ytdlp.error)
      if (health?.ffmpeg?.installed === false) issues.push(health.ffmpeg.error)
      if (health?.spotdl?.installed === false) issues.push(health.spotdl.error)
      if (issues.length) setSetupError(issues.join(' · '))
    })
  }, [])

  const jobByPlaylistId = useMemo(() => {
    const map = new Map()
    for (const item of job?.items ?? []) {
      map.set(item.youtubePlaylistId, item)
    }
    return map
  }, [job])

  const readyRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!row.valid || !row.cleanUrl) return false
        if (row.useYoutubeTitlesOnly) return true
        return row.selectedMatch?.spotifyAlbumId && row.uiStatus === 'ready'
      }),
    [rows],
  )

  const downloadState = getDownloadButtonState({ rows, readyRows, isRunning, job })
  const currentStep = getCurrentStep(rows, isRunning, job)
  const setup = setupError ? friendlyError(setupError) : null

  const schedulePreview = useCallback((rowId, url) => {
    const timers = previewTimers.current
    const existing = timers.get(rowId)
    if (existing) clearTimeout(existing)

    const existingAbort = previewAbort.current.get(rowId)
    if (existingAbort) existingAbort.abort()

    const trimmed = url.trim()
    if (!trimmed) {
      setRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...createRow(), id: rowId } : row)),
      )
      return
    }

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              uiStatus: 'reading',
              valid: false,
              error: null,
              selectedMatch: null,
              candidates: [],
              needsReview: false,
              useYoutubeTitlesOnly: false,
              videoTitles: [],
              phaseStartedAt: Date.now(),
            }
          : row,
      ),
    )

    const timer = setTimeout(async () => {
      const abort = new AbortController()
      previewAbort.current.set(rowId, abort)

      try {
        const read = await readPlaylist(trimmed, abort.signal)
        if (abort.signal.aborted) return

        setRows((prev) => {
          const updated = prev.map((row) => {
            if (row.id !== rowId || row.url.trim() !== trimmed) return row
            if (row.phaseStartedAt) {
              recordPreviewDuration('read', Date.now() - row.phaseStartedAt)
            }
            return {
              ...row,
              uiStatus: 'searching',
              valid: true,
              playlistTitle: read.youtube.title,
              videoCount: read.youtube.videoCount,
              videoTitles: read.youtube.videoTitles ?? [],
              youtubePlaylistId: read.youtube.playlistId,
              cleanUrl: read.youtube.url,
              phaseStartedAt: Date.now(),
            }
          })

          const current = updated.find((r) => r.id === rowId)
          if (current?.valid && !addedRowForUrl.current.has(trimmed)) {
            addedRowForUrl.current.add(trimmed)
            if (!updated.some((r) => !r.url.trim())) {
              return [...updated, createRow()]
            }
          }
          return updated
        })

        const match = await matchPlaylist(read.youtube, abort.signal)
        if (abort.signal.aborted) return

        setRows((prev) =>
          prev.map((row) => {
            if (row.id !== rowId || row.url.trim() !== trimmed) return row
            if (row.useYoutubeTitlesOnly) return row
            if (row.phaseStartedAt) {
              recordPreviewDuration('match', Date.now() - row.phaseStartedAt)
            }

            const uiStatus =
              match.needsReview && !match.selectedMatch ? 'needs_review' : 'ready'

            return {
              ...row,
              uiStatus,
              selectedMatch: match.selectedMatch,
              candidates: match.candidates ?? [],
              needsReview: match.needsReview,
              error: match.error || match.message || null,
              phaseStartedAt: null,
            }
          }),
        )
      } catch (err) {
        if (err.name === 'AbortError') return
        setRows((prev) =>
          prev.map((row) =>
            row.id === rowId && row.url.trim() === trimmed
              ? {
                  ...row,
                  uiStatus: row.valid ? 'needs_review' : 'failed',
                  valid: row.valid || false,
                  error: err.message || 'Preview failed',
                }
              : row,
          ),
        )
      } finally {
        if (previewAbort.current.get(rowId) === abort) {
          previewAbort.current.delete(rowId)
        }
      }
    }, 500)

    timers.set(rowId, timer)
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of previewTimers.current.values()) clearTimeout(timer)
      for (const abort of previewAbort.current.values()) abort.abort()
    }
  }, [])

  function handleUrlChange(rowId, value) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, url: value } : row)))
    schedulePreview(rowId, value)
  }

  function handleSelectMatch(rowId, candidate) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              selectedMatch: candidate,
              needsReview: false,
              useYoutubeTitlesOnly: false,
              uiStatus: 'ready',
              error: null,
            }
          : row,
      ),
    )
  }

  async function handleSpotifyAlbumLink(rowId, spotifyUrl) {
    const match = await resolveSpotifyAlbum(spotifyUrl)
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              selectedMatch: match,
              candidates: [match],
              needsReview: false,
              useYoutubeTitlesOnly: false,
              uiStatus: 'ready',
              error: null,
            }
          : row,
      ),
    )
  }

  function handleUseYoutubeTitles(rowId) {
    const existingAbort = previewAbort.current.get(rowId)
    if (existingAbort) existingAbort.abort()

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              useYoutubeTitlesOnly: true,
              selectedMatch: null,
              needsReview: false,
              uiStatus: 'ready',
              error: null,
            }
          : row,
      ),
    )
  }

  function handleRemove(rowId) {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId)
      return next.length ? next : [createRow()]
    })
    const timer = previewTimers.current.get(rowId)
    if (timer) clearTimeout(timer)
    const abort = previewAbort.current.get(rowId)
    if (abort) abort.abort()
  }

  async function handleDownloadAll() {
    if (downloadState.disabled) return
    setIsRunning(true)
    setJob(null)

    const items = readyRows.map((row) => ({
      youtubeUrl: row.cleanUrl,
      youtubePlaylistId: row.youtubePlaylistId,
      playlistTitle: row.playlistTitle,
      videoTitles: row.videoTitles,
      useYoutubeTitlesOnly: row.useYoutubeTitlesOnly,
      spotifyAlbumId: row.useYoutubeTitlesOnly ? null : row.selectedMatch?.spotifyAlbumId,
      spotifyAlbumName: row.useYoutubeTitlesOnly ? null : row.selectedMatch?.name,
      spotifyArtist: row.useYoutubeTitlesOnly ? null : row.selectedMatch?.artist,
    }))

    try {
      const { jobId } = await startJob(items, 'safe')
      let active = true
      while (active) {
        const status = await getJob(jobId)
        setJob(status)
        if (status.status === 'done' || status.status === 'failed') active = false
        else await new Promise((r) => setTimeout(r, 1000))
      }
    } catch (err) {
      setSetupError(err.message)
    } finally {
      setIsRunning(false)
    }
  }

  const activeCards = rows.filter((r) => r.url?.trim())

  return (
    <div className="app">
      <header className="app-header">
        <h1>Music Downloader</h1>
        <p className="app-header__sub">
          Paste YouTube playlists. The app downloads the audio and adds clean album info.
        </p>
      </header>

      {setup ? (
        <div className="banner banner--error" role="alert">
          <p>{setup.text}</p>
          {setup.fix ? <p>{setup.fix}</p> : null}
        </div>
      ) : null}

      <StepNav currentStep={currentStep} />

      <main className="main-card">
        <div className="album-list">
          {rows.map((row) => (
            <AlbumCard
              key={row.id}
              row={row}
              jobItem={row.youtubePlaylistId ? jobByPlaylistId.get(row.youtubePlaylistId) : null}
              canRemove={rows.length > 1 || Boolean(row.url.trim())}
              disabled={isRunning}
              onUrlChange={handleUrlChange}
                onSelectMatch={handleSelectMatch}
                onUseYoutubeTitles={handleUseYoutubeTitles}
                onSpotifyAlbumLink={handleSpotifyAlbumLink}
                onRemove={handleRemove}
            />
          ))}
        </div>

        {activeCards.length > 0 ? (
          <button
            type="button"
            className="text-link text-link--add"
            onClick={() => setRows((p) => [...p, createRow()])}
            disabled={isRunning}
          >
            + Add another playlist
          </button>
        ) : null}

        <footer className="download-footer">
          <button
            type="button"
            className="btn-download"
            onClick={handleDownloadAll}
            disabled={downloadState.disabled}
          >
            {downloadState.label}
          </button>
          {downloadState.reason ? (
            <p className="download-footer__reason">{downloadState.reason}</p>
          ) : null}
        </footer>
      </main>
    </div>
  )
}
