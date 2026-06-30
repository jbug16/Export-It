import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelJob,
  downloadTrackWithMatch,
  fetchAlternatives,
  fetchHealth,
  fetchSettings,
  fetchSpotifyMe,
  getJob,
  pickFolder,
  resolveSpotifyUrl,
  saveSettings,
  startJob,
  startSpotifyLogin,
  spotifyLogout,
} from './api.js'
import AlternativesModal from './components/AlternativesModal.jsx'
import { IconButton } from './components/Buttons.jsx'
import ConnectScreen from './components/layout/ConnectScreen.jsx'
import AppHeader from './components/layout/AppHeader.jsx'
import CompletionView from './components/layout/CompletionView.jsx'
import DownloadSummaryCard from './components/layout/DownloadSummaryCard.jsx'
import IssueReview from './components/layout/IssueReview.jsx'
import ProgressView from './components/layout/ProgressView.jsx'
import SpotifyLinksSection from './components/layout/SpotifyLinksSection.jsx'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { getRowBadge, isSpotifyUrl, normalizeSpotifyUrl } from './utils/status.js'
import {
  countDownloaded,
  findDownloadProgress,
  getScreenState,
} from './utils/screenState.js'
import './App.css'

const SPOTIFY_CONNECT_KEY = 'export_it_spotify_connecting'

let nextLinkId = 1
let nextItemId = 1

function createLinkRow(url = '') {
  return { id: nextLinkId++, url, status: 'empty', error: null, itemId: null }
}

function initialErrorFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const err = params.get('spotify_error')
  if (err) {
    window.history.replaceState({}, '', window.location.pathname)
    return err
  }
  return ''
}

function mergeTracksFromItems(items) {
  const tracks = []
  for (const item of items) {
    for (const track of item.tracks) {
      tracks.push({
        ...track,
        playlist: track.playlist || item.name,
        _sourceId: item.id,
        _sourceName: item.name,
      })
    }
  }
  return tracks
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [spotifyUser, setSpotifyUser] = useState(null)
  const [spotifyConnectionStatus, setSpotifyConnectionStatus] = useState('disconnected')
  const [linkRows, setLinkRows] = useState([createLinkRow()])
  const [detectedItems, setDetectedItems] = useState([])
  const [expandedSongItems, setExpandedSongItems] = useState(() => new Set())
  const [outDir, setOutDir] = useState('')
  const [settings, setSettings] = useState({})
  const [job, setJob] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [error, setError] = useState(initialErrorFromUrl)
  const [altRow, setAltRow] = useState(null)
  const [altOptions, setAltOptions] = useState([])
  const [altLoading, setAltLoading] = useState(false)
  const [reviewingIssues, setReviewingIssues] = useState(false)
  const [browsingFolder, setBrowsingFolder] = useState(false)
  const pollRef = useRef(null)
  const connectLockRef = useRef(false)

  const tracks = useMemo(() => mergeTracksFromItems(detectedItems), [detectedItems])
  const jobPlaylist = detectedItems.length === 1 ? detectedItems[0].name : null
  const primarySource = detectedItems[0] || null

  const itemTrackOffsets = useMemo(() => {
    const map = new Map()
    let offset = 0
    for (const item of detectedItems) {
      map.set(item.id, offset)
      offset += item.tracks.length
    }
    return map
  }, [detectedItems])

  const rowMap = useMemo(() => {
    const map = new Map()
    for (const row of job?.rows ?? []) {
      map.set(row.index, row)
    }
    return map
  }, [job])

  const isRunning = job?.status === 'running' || job?.status === 'queued'
  const hasReadyItems = detectedItems.length > 0
  const canDownload = hasReadyItems && outDir.trim() && !isRunning && spotifyConnectionStatus === 'connected'

  const issueCount = useMemo(() => {
    if (!job?.rows) return 0
    return job.rows.filter((row) => {
      const badge = getRowBadge(row, true)
      return badge.variant === 'failed' || badge.variant === 'review' || badge.variant === 'skipped'
    }).length
  }, [job])

  const screenState = getScreenState({
    detectedItems,
    job,
    isRunning,
    reviewingIssues,
  })

  const isQueueState = ['empty', 'detected', 'multiDetected'].includes(screenState)
  const showWorkflowGrid = isQueueState || screenState === 'downloading' || screenState === 'done' || screenState === 'doneIssues'

  const progressPct = useMemo(() => {
    if (!job?.total) return 0
    if (job.status === 'done') return 100
    return Math.round((job.processed / job.total) * 100)
  }, [job])

  const issueRows = useMemo(() => {
    const list = []
    if (!job?.rows) return list
    for (const row of job.rows) {
      const badge = getRowBadge(row, true)
      if (badge.variant === 'failed' || badge.variant === 'review' || badge.variant === 'skipped') {
        const track = tracks[row.index]
        if (track) list.push({ track, index: row.index, row })
      }
    }
    return list
  }, [job, tracks])

  const isConnected = spotifyConnectionStatus === 'connected'

  const downloadProgress = useMemo(() => {
    if (!job?.rows?.length || !isRunning) return null
    return findDownloadProgress(detectedItems, itemTrackOffsets, job.rows)
  }, [job, isRunning, detectedItems, itemTrackOffsets])

  const downloadedCount = job ? countDownloaded(job.rows) : 0
  const totalTracks = tracks.length

  const getItemForRow = useCallback(
    (row) => detectedItems.find((item) => item.id === row.itemId) ?? null,
    [detectedItems],
  )

  const toggleSongs = useCallback((itemId) => {
    setExpandedSongItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const params = new URLSearchParams(window.location.search)
      const oauthReturn = params.get('spotify_connected') || params.get('spotify_error')
      if (sessionStorage.getItem(SPOTIFY_CONNECT_KEY) && oauthReturn) {
        setSpotifyConnectionStatus('connecting')
      }

      try {
        const [h, me, s] = await Promise.all([
          fetchHealth(),
          fetchSpotifyMe(),
          fetchSettings(),
        ])
        if (cancelled) return
        setHealth(h)
        setSettings(s)
        if (s.output_dir) setOutDir(s.output_dir)
        else if (h.defaultOutDir) setOutDir(h.defaultOutDir)

        if (me.connected) {
          setSpotifyUser(me.user)
          setSpotifyConnectionStatus('connected')
          sessionStorage.removeItem(SPOTIFY_CONNECT_KEY)
          connectLockRef.current = false
        } else if (params.get('spotify_error')) {
          setSpotifyUser(null)
          setSpotifyConnectionStatus('disconnected')
          sessionStorage.removeItem(SPOTIFY_CONNECT_KEY)
          connectLockRef.current = false
        } else {
          setSpotifyUser(null)
          setSpotifyConnectionStatus('disconnected')
          sessionStorage.removeItem(SPOTIFY_CONNECT_KEY)
          connectLockRef.current = false
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setSpotifyConnectionStatus('disconnected')
          sessionStorage.removeItem(SPOTIFY_CONNECT_KEY)
          connectLockRef.current = false
        }
      }

      if (params.get('spotify_connected')) {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
    init()
    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const j = await getJob(jobId)
        if (!pollRef.current) return
        if (['done', 'failed', 'cancelled'].includes(j.status)) {
          clearInterval(pollRef.current)
          pollRef.current = null
          if (j.status === 'cancelled') {
            setJob(null)
            setJobId(null)
            return
          }
        }
        setJob(j)
      } catch (err) {
        setError(err.message)
      }
    }, 800)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobId])

  const detectLink = useCallback(async (rowId, url) => {
    const trimmed = url.trim()
    if (!trimmed) {
      setLinkRows((rows) => {
        const row = rows.find((r) => r.id === rowId)
        if (row?.itemId) {
          setDetectedItems((items) => items.filter((item) => item.id !== row.itemId))
          setExpandedSongItems((prev) => {
            const next = new Set(prev)
            if (row.itemId) next.delete(row.itemId)
            return next
          })
        }
        return rows.map((r) => (r.id === rowId ? { ...r, status: 'empty', error: null, itemId: null } : r))
      })
      return
    }

    if (!isSpotifyUrl(trimmed)) {
      setLinkRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, status: 'invalid', error: 'Invalid Spotify link.', itemId: null } : r)))
      return
    }

    const normalized = normalizeSpotifyUrl(trimmed)
    let isDuplicate = false
    setLinkRows((rows) => {
      isDuplicate = rows.some((r) => r.id !== rowId && r.url.trim() && normalizeSpotifyUrl(r.url) === normalized && r.status === 'ready')
      return rows.map((r) => (r.id === rowId ? { ...r, status: isDuplicate ? 'duplicate' : 'detecting', error: isDuplicate ? 'Duplicate link.' : null } : r))
    })
    if (isDuplicate) return

    if (spotifyConnectionStatus !== 'connected') {
      setLinkRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, status: 'error', error: 'Connect Spotify first.', itemId: null } : r)))
      return
    }

    let previousItemId = null
    setLinkRows((rows) => {
      previousItemId = rows.find((r) => r.id === rowId)?.itemId ?? null
      return rows
    })

    try {
      const res = await resolveSpotifyUrl(trimmed)
      const itemId = nextItemId++
      const item = {
        id: itemId,
        type: res.type,
        name: res.name,
        owner: res.owner,
        coverUrl: res.coverUrl,
        trackCount: res.trackCount ?? res.tracks?.length ?? 0,
        tracks: res.tracks,
      }
      setDetectedItems((items) => {
        const withoutOld = items.filter((i) => i.id !== previousItemId)
        return [...withoutOld, item]
      })
      if (previousItemId) {
        setExpandedSongItems((prev) => {
          const next = new Set(prev)
          next.delete(previousItemId)
          return next
        })
      }
      setLinkRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, status: 'ready', error: null, itemId, url: trimmed } : r)))
      setJob(null)
      setJobId(null)
      setReviewingIssues(false)
    } catch (err) {
      setLinkRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, status: 'error', error: err.message || 'Could not detect.', itemId: null } : r)))
    }
  }, [spotifyConnectionStatus])

  function updateLinkUrl(rowId, url) {
    if (!url.trim()) {
      setLinkRows((rows) => {
        const row = rows.find((r) => r.id === rowId)
        if (row?.itemId) {
          setDetectedItems((items) => items.filter((item) => item.id !== row.itemId))
          setExpandedSongItems((prev) => {
            const next = new Set(prev)
            if (row.itemId) next.delete(row.itemId)
            return next
          })
        }
        return rows.map((r) => (r.id === rowId ? { ...r, url, status: 'empty', error: null, itemId: null } : r))
      })
      return
    }
    setLinkRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, url, error: null } : r)))
  }

  function handleAddLink() {
    setLinkRows((rows) => {
      const hasEmpty = rows.some((r) => !r.url.trim() && !r.itemId)
      if (hasEmpty) return rows
      return [...rows, createLinkRow()]
    })
  }

  function handleRemoveLink(rowId) {
    setLinkRows((rows) => {
      const row = rows.find((r) => r.id === rowId)
      if (row?.itemId) {
        setDetectedItems((items) => items.filter((item) => item.id !== row.itemId))
        setExpandedSongItems((prev) => {
          const next = new Set(prev)
          if (row.itemId) next.delete(row.itemId)
          return next
        })
      }
      if (rows.length === 1) {
        setJob(null)
        setJobId(null)
        return [createLinkRow()]
      }
      return rows.filter((r) => r.id !== rowId)
    })
  }

  function handleRowPaste(rowId, e) {
    const pasted = e.clipboardData?.getData('text')
    if (pasted?.trim()) {
      e.preventDefault()
      updateLinkUrl(rowId, pasted.trim())
      detectLink(rowId, pasted.trim())
    }
  }

  function handleRowDetect(rowId) {
    const row = linkRows.find((r) => r.id === rowId)
    if (row) detectLink(rowId, row.url)
  }

  function handleOutDirChange(value) {
    setOutDir(value)
    setSettings((prev) => ({ ...prev, output_dir: value }))
  }

  async function handleBrowseFolder() {
    if (browsingFolder) return
    setBrowsingFolder(true)
    setError('')
    // Let the loading spinner paint before the native picker request starts.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    try {
      const result = await pickFolder(outDir)
      if (!result.cancelled && result.path) {
        handleOutDirChange(result.path)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBrowsingFolder(false)
    }
  }

  async function handleConnect() {
    if (connectLockRef.current || spotifyConnectionStatus === 'connecting') return
    connectLockRef.current = true
    setSpotifyConnectionStatus('connecting')
    setError('')
    sessionStorage.setItem(SPOTIFY_CONNECT_KEY, '1')
    try {
      await startSpotifyLogin()
    } catch (err) {
      setError(err.message)
      setSpotifyConnectionStatus('disconnected')
      sessionStorage.removeItem(SPOTIFY_CONNECT_KEY)
      connectLockRef.current = false
    }
  }

  async function handleDisconnect() {
    setError('')
    try {
      await spotifyLogout()
    } catch (err) {
      setError(err.message)
      return
    }
    setSpotifyUser(null)
    setSpotifyConnectionStatus('disconnected')
    connectLockRef.current = false
    sessionStorage.removeItem(SPOTIFY_CONNECT_KEY)
    handleClear()
  }

  async function handleDownload() {
    setError('')
    setReviewingIssues(false)
    try {
      await saveSettings({ ...settings, output_dir: outDir })
      const j = await startJob({
        tracks,
        playlist: jobPlaylist,
        outDir,
        sourceType: primarySource?.type || null,
        fmt: settings.fmt || 'mp3',
        writeM3u8: primarySource?.type !== 'album' && Boolean(settings.write_m3u8),
        writeM3uPlain: primarySource?.type !== 'album' && settings.write_m3u_plain !== false,
        embedArt: settings.embed_art !== false,
        mp3Quality: Number(settings.mp3_quality ?? 0),
        forceDownload: Boolean(settings.force_download),
        cookiesBrowser: settings.cookies_browser || null,
        cookiesFile: settings.cookies_file || null,
      })
      setJob(j)
      setJobId(j.id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStop() {
    if (!jobId) return
    const id = jobId
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setJobId(null)
    setJob(null)
    try {
      await cancelJob(id)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleClear() {
    setLinkRows([createLinkRow()])
    setDetectedItems([])
    setExpandedSongItems(new Set())
    setJob(null)
    setJobId(null)
    setReviewingIssues(false)
    setError('')
  }

  async function openAlternatives(index) {
    const track = tracks[index]
    if (!track) return
    setAltRow(index)
    setAltOptions([])
    setAltLoading(true)
    try {
      const row = rowMap.get(index)
      const exclude = row?.match?.videoId ? [row.match.videoId] : []
      const res = await fetchAlternatives(track, exclude)
      setAltOptions(res.options || [])
    } catch (err) {
      setError(err.message)
      setAltRow(null)
    } finally {
      setAltLoading(false)
    }
  }

  async function pickAlternative(match) {
    if (altRow == null || !jobId) return
    try {
      await downloadTrackWithMatch(jobId, altRow, match)
      const j = await getJob(jobId)
      setJob(j)
    } catch (err) {
      setError(err.message)
    }
    setAltRow(null)
  }

  const downloadLabel = detectedItems.length > 1 ? 'Download All' : 'Download'
  const savedPath = outDir.trim()

  return (
    <div className={`app-shell${isConnected ? '' : ' app-shell-connect'}`}>
      {!isConnected ? (
        <>
          {health && !health.ok && (
            <div className="banner banner-warn" role="status">
              <strong>Setup required</strong>
              <p>{(health.errors || []).join(', ')}</p>
            </div>
          )}
          <ConnectScreen
            status={spotifyConnectionStatus === 'connecting' ? 'connecting' : 'disconnected'}
            connectError={error}
            onConnect={handleConnect}
          />
        </>
      ) : (
        <>
          <AppHeader displayName={spotifyUser?.displayName} onDisconnect={handleDisconnect} />
          {error && (
            <div className="banner banner-error" role="alert">
              <span>{error}</span>
              <IconButton icon={faXmark} label="Dismiss" onClick={() => setError('')} className="banner-dismiss" />
            </div>
          )}
          {health && !health.ok && (
            <div className="banner banner-warn" role="status">
              <strong>Setup required</strong>
              <p>{(health.errors || []).join(', ')}</p>
            </div>
          )}

          <main className="main-content">
            {screenState === 'error' && (
              <IssueReview
                issues={issueRows}
                onRetry={openAlternatives}
                onHide={() => setReviewingIssues(false)}
              />
            )}

            {showWorkflowGrid && (
              <div className="workflow-grid">
                <div className="workflow-main">
                  <SpotifyLinksSection
                    rows={linkRows}
                    getItemForRow={getItemForRow}
                    onUrlChange={updateLinkUrl}
                    onPaste={handleRowPaste}
                    onDetect={handleRowDetect}
                    onRemove={handleRemoveLink}
                    onAddLink={handleAddLink}
                    canAddLink={!isRunning}
                    expandedSongItems={expandedSongItems}
                    onToggleSongs={toggleSongs}
                    jobRows={job?.rows}
                    itemTrackOffsets={itemTrackOffsets}
                    showTrackStatus={Boolean(job?.rows?.length)}
                  />
                </div>

                <aside className="workflow-sidebar">
                  {isQueueState && (
                    <DownloadSummaryCard
                      itemCount={detectedItems.length}
                      songCount={tracks.length}
                      settings={settings}
                      outDir={outDir}
                      onSettingsChange={setSettings}
                      onOutDirChange={handleOutDirChange}
                      onBrowseFolder={handleBrowseFolder}
                      browseLoading={browsingFolder}
                      browseDisabled={browsingFolder || isRunning}
                      downloadLabel={downloadLabel}
                      onDownload={handleDownload}
                      disabled={!canDownload}
                    />
                  )}

                  {screenState === 'downloading' && (
                    <ProgressView
                      progress={downloadProgress}
                      progressPct={progressPct}
                      onStop={handleStop}
                    />
                  )}

                  {(screenState === 'done' || screenState === 'doneIssues') && (
                    <CompletionView
                      compact
                      downloaded={downloadedCount}
                      total={job?.total ?? totalTracks}
                      savedPath={savedPath}
                      issueCount={screenState === 'doneIssues' ? issueCount : 0}
                      onDownloadMore={handleClear}
                    />
                  )}
                </aside>
              </div>
            )}
          </main>

          {altRow != null && (
            <AlternativesModal
              loading={altLoading}
              options={altOptions}
              track={tracks[altRow]}
              onClose={() => setAltRow(null)}
              onPick={pickAlternative}
            />
          )}
        </>
      )}
    </div>
  )
}
