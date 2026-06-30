import { useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelJob,
  downloadTrackWithMatch,
  fetchAlternatives,
  fetchHealth,
  fetchPreview,
  fetchSettings,
  fetchSpotifyMe,
  getJob,
  importCsv,
  resolveSpotifyUrl,
  saveSettings,
  spotifyLogout,
  startJob,
  startSpotifyLogin,
} from './api.js'
import AlternativesModal from './components/AlternativesModal.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import './App.css'

const CONFIDENCE_MIN = 0.6

function initialErrorFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const err = params.get('spotify_error')
  if (err) {
    window.history.replaceState({}, '', window.location.pathname)
    return err
  }
  return ''
}

function formatConfidence(value) {
  if (!value) return '—'
  return `${Math.round(value * 100)}%`
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [spotifyUser, setSpotifyUser] = useState(null)
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [source, setSource] = useState(null)
  const [tracks, setTracks] = useState([])
  const [playlistName, setPlaylistName] = useState('')
  const [outDir, setOutDir] = useState('')
  const [settings, setSettings] = useState({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [job, setJob] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(initialErrorFromUrl)
  const [loading, setLoading] = useState(false)
  const [altRow, setAltRow] = useState(null)
  const [altOptions, setAltOptions] = useState([])
  const [altLoading, setAltLoading] = useState(false)
  const pollRef = useRef(null)
  const csvInputRef = useRef(null)

  const rowMap = useMemo(() => {
    const map = new Map()
    for (const row of job?.rows ?? []) {
      map.set(row.index, row)
    }
    return map
  }, [job])

  const isRunning = job?.status === 'running' || job?.status === 'queued'
  const canStart = tracks.length > 0 && outDir.trim() && !isRunning

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const [h, me, s, p] = await Promise.all([
          fetchHealth(),
          fetchSpotifyMe(),
          fetchSettings(),
          fetchPreview().catch(() => null),
        ])
        if (cancelled) return
        setHealth(h)
        setSpotifyUser(me.connected ? me.user : null)
        setSettings(s)
        if (s.output_dir) setOutDir(s.output_dir)
        else if (h.defaultOutDir) setOutDir(h.defaultOutDir)
        if (p?.tracks?.length) {
          setTracks(p.tracks)
          setPlaylistName(p.playlist || p.sourceName || '')
          setSource({ type: p.sourceType, name: p.sourceName, coverUrl: p.coverUrl })
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    init()
    const params = new URLSearchParams(window.location.search)
    if (params.get('spotify_connected')) {
      fetchSpotifyMe().then((me) => {
        if (!cancelled) setSpotifyUser(me.connected ? me.user : null)
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
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
        setJob(j)
        setLogs(j.logs || [])
        if (['done', 'failed', 'cancelled'].includes(j.status)) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch (err) {
        setError(err.message)
      }
    }, 800)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobId])

  async function handleConnect() {
    setError('')
    try {
      await startSpotifyLogin()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleLogout() {
    await spotifyLogout()
    setSpotifyUser(null)
  }

  async function handleResolveSpotify() {
    setError('')
    setLoading(true)
    try {
      const res = await resolveSpotifyUrl(spotifyUrl.trim())
      setTracks(res.tracks)
      setPlaylistName(res.playlist || res.name)
      setSource({ type: res.type, name: res.name, coverUrl: res.coverUrl, owner: res.owner })
      setJob(null)
      setJobId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCsv(file) {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const res = await importCsv(file)
      setTracks(res.tracks)
      setPlaylistName(res.playlist || res.name)
      setSource({ type: 'csv', name: res.name })
      setJob(null)
      setJobId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    setError('')
    setLogs([])
    try {
      await saveSettings({ ...settings, output_dir: outDir })
      const j = await startJob({
        tracks,
        playlist: playlistName,
        outDir,
        sourceType: source?.type || null,
        fmt: settings.fmt || 'mp3',
        writeM3u8: source?.type !== 'album' && Boolean(settings.write_m3u8),
        writeM3uPlain: source?.type !== 'album' && settings.write_m3u_plain !== false,
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

  async function handleCancel() {
    if (!jobId) return
    await cancelJob(jobId)
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
    if (altRow == null) return
    if (!jobId) {
      setError('Start the download first, then pick an alternative for a track.')
      setAltRow(null)
      return
    }
    try {
      await downloadTrackWithMatch(jobId, altRow, match)
      const j = await getJob(jobId)
      setJob(j)
    } catch (err) {
      setError(err.message)
    }
    setAltRow(null)
  }

  function rowClass(index) {
    const row = rowMap.get(index)
    if (!row) return ''
    if (row.skipped || row.lowConfidence || (row.confidence > 0 && row.confidence < CONFIDENCE_MIN)) {
      return 'row-warn'
    }
    if (row.downloaded) return 'row-done'
    if (row.error) return 'row-fail'
    return ''
  }

  const progressPct = job?.total ? Math.round((job.processed / job.total) * 100) : 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Export-It</h1>
          <span className="subtitle">CSVMusic-style downloader</span>
        </div>
        <div className="topbar-actions">
          {spotifyUser ? (
            <div className="spotify-user">
              <span>{spotifyUser.displayName || 'Spotify'}</span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                Disconnect
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-spotify" onClick={handleConnect}>
              Connect Spotify
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => setHelpOpen((v) => !v)}>
            Help
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      {helpOpen && (
        <section className="help-panel">
          <p><strong>Spotify:</strong> Connect, paste an album or playlist URL, click Load.</p>
          <p><strong>CSV fallback:</strong> Drop a TuneMyMusic CSV if you already have one.</p>
          <p><strong>Download:</strong> Set output folder, click Start. Yellow rows = low confidence — try Alternatives.</p>
        </section>
      )}

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>×</button>
        </div>
      )}

      {health && !health.ok && (
        <div className="banner banner-warn">
          Setup issues: {(health.errors || []).join(' · ')}
        </div>
      )}

      <section className="import-panel">
        <div className="import-row">
          <label className="field-label">Spotify album or playlist URL</label>
          <div className="field-row">
            <input
              type="url"
              placeholder="https://open.spotify.com/album/… or playlist/…"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              disabled={!spotifyUser || loading}
            />
            <button type="button" className="btn btn-primary" disabled={!spotifyUser || !spotifyUrl.trim() || loading} onClick={handleResolveSpotify}>
              Load
            </button>
          </div>
        </div>

        <div
          className="csv-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) handleCsv(file)
          }}
          onClick={() => csvInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && csvInputRef.current?.click()}
        >
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => handleCsv(e.target.files?.[0])}
          />
          <strong>Or drop a TuneMyMusic CSV here</strong>
          <span>Click to browse</span>
        </div>

        <div className="import-row">
          <label className="field-label">Output folder</label>
          <input
            type="text"
            placeholder="e.g. /Users/you/Music"
            value={outDir}
            onChange={(e) => setOutDir(e.target.value)}
          />
        </div>
      </section>

      {source && (
        <section className="source-summary">
          {source.coverUrl && <img src={source.coverUrl} alt="" className="cover" />}
          <div>
            <div className="source-type">{source.type === 'album' ? 'Album' : source.type === 'playlist' ? 'Playlist' : 'CSV'}</div>
            <h2>{source.name}</h2>
            {source.owner && <p className="muted">{source.owner}</p>}
            <p className="muted">{tracks.length} tracks</p>
          </div>
        </section>
      )}

      {tracks.length > 0 && (
        <section className="track-section">
          <div className="track-toolbar">
            <span>{job ? `Matched ${job.matched} · Skipped ${job.skipped}` : `${tracks.length} tracks ready`}</span>
            <div className="track-toolbar-actions">
              {isRunning && (
                <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                  Cancel
                </button>
              )}
              <button type="button" className="btn btn-start" disabled={!canStart} onClick={handleStart}>
                {isRunning ? 'Downloading…' : 'Start'}
              </button>
            </div>
          </div>

          {job && (
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progressPct}%` }} />
              <span className="progress-label">{job.processed}/{job.total} · {job.message}</span>
            </div>
          )}

          <div className="table-wrap">
            <table className="track-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Artist</th>
                  <th>Album</th>
                  <th>Status</th>
                  <th>Match</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tracks.map((t, i) => {
                  const row = rowMap.get(i)
                  const status = row?.status || (job ? 'Queued' : 'Ready')
                  return (
                    <tr key={`${t.sp_id || t.title}-${i}`} className={rowClass(i)}>
                      <td>{i + 1}</td>
                      <td>{t.title}</td>
                      <td>{t.artists}</td>
                      <td>{t.album}</td>
                      <td className="status-cell">{status}</td>
                      <td>{formatConfidence(row?.confidence)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => openAlternatives(i)}
                        >
                          Alternatives
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {logs.length > 0 && (
        <section className="log-panel">
          <h3>Log</h3>
          <pre>{logs.join('\n')}</pre>
        </section>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={async (next) => {
            const saved = await saveSettings(next)
            setSettings(saved)
            if (saved.output_dir) setOutDir(saved.output_dir)
            setSettingsOpen(false)
          }}
        />
      )}

      {altRow != null && (
        <AlternativesModal
          loading={altLoading}
          options={altOptions}
          track={tracks[altRow]}
          onClose={() => setAltRow(null)}
          onPick={pickAlternative}
        />
      )}
    </div>
  )
}
