import { useEffect, useState } from 'react'
import { friendlyError } from '../lib/errorMessages.js'
import { candidateCompareHint, candidateFactsLine, songCountLabel } from '../lib/matchLabels.js'
import { getLoadProgress } from '../lib/loadTiming.js'

function downloadProgressText(jobItem) {
  if (jobItem.status === 'downloading' && jobItem.downloadTotal > 0) {
    return `Downloading song ${jobItem.downloadCurrent} of ${jobItem.downloadTotal}`
  }
  if (jobItem.status === 'tagging') return 'Adding album details...'
  if (jobItem.status === 'complete') return 'Complete'
  if (jobItem.status === 'failed') return 'Download failed'
  if (jobItem.status === 'queued' || jobItem.status === 'ready') return 'Waiting to start...'
  return null
}

function downloadPercent(jobItem) {
  if (jobItem.status === 'complete') return 100
  if (jobItem.downloadTotal > 0) {
    return Math.round((jobItem.downloadCurrent / jobItem.downloadTotal) * 100)
  }
  if (jobItem.status === 'downloading' || jobItem.status === 'tagging') return 12
  return 0
}

function CoverImage({ src, className = 'album-card__cover' }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [src])

  const loading = Boolean(src) && !loaded && !failed
  const showShimmer = !src || loading

  return (
    <div
      className={`cover-image ${className}${showShimmer ? ' cover-image--loading' : ''}${failed ? ' cover-image--empty' : ''}`}
      aria-hidden
    >
      {showShimmer ? <div className="cover-image__shimmer" /> : null}
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className={`cover-image__img${loaded ? ' cover-image__img--visible' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  )
}

function LoadingBar({ phase, phaseStartedAt }) {
  const [loadState, setLoadState] = useState(() => getLoadProgress(phase, phaseStartedAt))

  useEffect(() => {
    setLoadState(getLoadProgress(phase, phaseStartedAt))
    const tick = setInterval(() => {
      setLoadState(getLoadProgress(phase, phaseStartedAt))
    }, 250)
    return () => clearInterval(tick)
  }, [phase, phaseStartedAt])

  const label = phase === 'reading' ? 'Reading…' : 'Finding album…'

  return (
    <div className="load-bar">
      <div className="load-bar__track">
        <div className="load-bar__fill" style={{ width: `${loadState.pct}%` }} />
      </div>
      <div className="load-bar__meta">
        <p className="load-bar__label">{label}</p>
        {loadState.remainingLabel ? (
          <span className="load-bar__timer">{loadState.remainingLabel}</span>
        ) : null}
      </div>
    </div>
  )
}

export default function AlbumCard({
  row,
  jobItem,
  canRemove,
  disabled,
  onUrlChange,
  onSelectMatch,
  onUseYoutubeTitles,
  onSpotifyAlbumLink,
  onRemove,
}) {
  const [spotifyLink, setSpotifyLink] = useState('')
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [spotifyLinkError, setSpotifyLinkError] = useState('')

  const statusKey = row.uiStatus ?? 'empty'
  const hasAlbum = Boolean(row.playlistTitle)
  const err = row.error || jobItem?.error ? friendlyError(row.error || jobItem?.error) : null

  const needsUserPick =
    statusKey === 'needs_review' && !row.selectedMatch && !row.useYoutubeTitlesOnly

  const isLoading = statusKey === 'reading' || statusKey === 'searching'
  const isDownloading =
    jobItem && ['queued', 'ready', 'downloading', 'tagging'].includes(jobItem.status)
  const isDone = jobItem?.status === 'complete'

  const coverUrl =
    !needsUserPick &&
    (row.selectedMatch?.coverUrl || row.candidates?.[0]?.coverUrl || null)

  const showYoutubeSource = needsUserPick && hasAlbum

  const isReady =
    statusKey === 'ready' &&
    !isLoading &&
    !isDownloading &&
    !isDone &&
    !needsUserPick &&
    (row.selectedMatch || row.useYoutubeTitlesOnly)

  const showSkip =
    row.valid && !row.useYoutubeTitlesOnly && (statusKey === 'searching' || needsUserPick)

  return (
    <article
      className={`album-card${needsUserPick ? ' album-card--pick' : ''}${isReady ? ' album-card--ready' : ''}`}
    >
      <div className="album-card__top">
        <input
          type="url"
          className="album-card__input"
          placeholder="Paste a YouTube playlist link"
          value={row.url}
          disabled={disabled}
          onChange={(e) => onUrlChange(row.id, e.target.value)}
          spellCheck={false}
        />
        {canRemove ? (
          <button
            type="button"
            className="album-card__remove"
            onClick={() => onRemove(row.id)}
            disabled={disabled}
            aria-label="Remove"
          >
            ×
          </button>
        ) : null}
      </div>

      {hasAlbum ? (
        <>
          {showYoutubeSource ? (
            <div className="album-card__source">
              <span className="album-card__source-label">YouTube playlist</span>
              <h3 className="album-card__title">{row.playlistTitle}</h3>
              {row.videoCount ? (
                <p className="album-card__songs">{songCountLabel(row.videoCount)}</p>
              ) : null}
            </div>
          ) : (
            <div className="album-card__row">
              <div className="album-card__cover-wrap">
                <CoverImage src={coverUrl} />
                {isReady ? (
                  <span
                    className="album-card__ready-badge"
                    aria-label="Ready to download"
                    title="Ready to download"
                  >
                    ✓
                  </span>
                ) : null}
              </div>
              <div className="album-card__info">
                <h3 className="album-card__title">{row.playlistTitle}</h3>
                {row.videoCount ? (
                  <p className="album-card__songs">{songCountLabel(row.videoCount)}</p>
                ) : null}
                {isDownloading && !isDone ? (
                  <p className="album-card__status-line album-card__status-line--active">
                    {downloadProgressText(jobItem)}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {isLoading ? (
            <LoadingBar
              phase={statusKey === 'reading' ? 'reading' : 'searching'}
              phaseStartedAt={row.phaseStartedAt}
            />
          ) : null}

          {needsUserPick && row.candidates?.length > 0 ? (
            <div className="pick-block">
              <p className="pick-block__title">Which Spotify album is this?</p>
              <p className="pick-block__sub">
                Cover art can look identical — compare the artist, year, and track count below.
              </p>
              <MatchOptions
                candidates={row.candidates}
                playlistSongCount={row.videoCount}
                selectedId={row.selectedMatch?.spotifyAlbumId}
                disabled={disabled}
                onSelect={(c) => onSelectMatch(row.id, c)}
              />
              <SpotifyPaste
                spotifyLink={spotifyLink}
                setSpotifyLink={setSpotifyLink}
                spotifyLoading={spotifyLoading}
                spotifyLinkError={spotifyLinkError}
                setSpotifyLinkError={setSpotifyLinkError}
                disabled={disabled}
                onSubmit={async () => {
                  setSpotifyLoading(true)
                  setSpotifyLinkError('')
                  try {
                    await onSpotifyAlbumLink(row.id, spotifyLink.trim())
                    setSpotifyLink('')
                  } catch (e) {
                    setSpotifyLinkError(e.message || 'Could not load album')
                  } finally {
                    setSpotifyLoading(false)
                  }
                }}
                inline
              />
            </div>
          ) : null}

          {needsUserPick && !row.candidates?.length ? (
            <div className="pick-block pick-block--empty">
              <p className="pick-block__title">No Spotify match found</p>
              <p className="pick-block__sub">
                Paste the correct Spotify album link for &ldquo;{row.playlistTitle}&rdquo;, or skip data sync.
              </p>
              <SpotifyPaste
                spotifyLink={spotifyLink}
                setSpotifyLink={setSpotifyLink}
                spotifyLoading={spotifyLoading}
                spotifyLinkError={spotifyLinkError}
                setSpotifyLinkError={setSpotifyLinkError}
                disabled={disabled}
                onSubmit={async () => {
                  setSpotifyLoading(true)
                  setSpotifyLinkError('')
                  try {
                    await onSpotifyAlbumLink(row.id, spotifyLink.trim())
                    setSpotifyLink('')
                  } catch (e) {
                    setSpotifyLinkError(e.message || 'Could not load album')
                  } finally {
                    setSpotifyLoading(false)
                  }
                }}
              />
              <button
                type="button"
                className="text-link"
                disabled={disabled}
                onClick={() => onUseYoutubeTitles(row.id)}
              >
                Skip data sync
              </button>
            </div>
          ) : null}

          {row.useYoutubeTitlesOnly && !isDownloading && !isDone && !isReady ? (
            <p className="album-card__note">Data sync skipped.</p>
          ) : null}

          {isDownloading && !isDone ? (
            <div className="album-card__progress" aria-hidden>
              <div
                className="album-card__progress-fill"
                style={{ width: `${downloadPercent(jobItem)}%` }}
              />
            </div>
          ) : null}

          {isDone && jobItem.musicFolder ? (
            <p className="album-card__saved">Saved to {jobItem.musicFolder}</p>
          ) : null}

          {(jobItem?.status === 'failed' || (statusKey === 'failed' && !jobItem)) && err ? (
            <div className="album-card__alert" role="alert">
              <p>{err.text}</p>
              {err.fix ? <p>{err.fix}</p> : null}
            </div>
          ) : null}

          {showSkip ? (
            <div className="album-card__footer">
              <button
                type="button"
                className="text-link"
                disabled={disabled}
                onClick={() => onUseYoutubeTitles(row.id)}
              >
                Skip data sync
              </button>
            </div>
          ) : null}
        </>
      ) : statusKey === 'reading' ? (
        <LoadingBar phase="reading" phaseStartedAt={row.phaseStartedAt} />
      ) : null}
    </article>
  )
}

function SpotifyPaste({
  spotifyLink,
  setSpotifyLink,
  spotifyLoading,
  spotifyLinkError,
  setSpotifyLinkError,
  disabled,
  onSubmit,
  inline,
}) {
  return (
    <>
      <div className={`spotify-paste${inline ? ' spotify-paste--inline' : ''}`}>
        <input
          type="url"
          className="spotify-paste__input"
          placeholder={inline ? 'Or paste Spotify album link' : 'https://open.spotify.com/album/...'}
          value={spotifyLink}
          disabled={disabled || spotifyLoading}
          onChange={(e) => {
            setSpotifyLink(e.target.value)
            setSpotifyLinkError('')
          }}
        />
        <button
          type="button"
          className="match-row__select"
          disabled={disabled || spotifyLoading || !spotifyLink.trim()}
          onClick={onSubmit}
        >
          {spotifyLoading ? 'Loading album…' : 'Use link'}
        </button>
      </div>
      {spotifyLinkError ? <p className="spotify-paste__error">{spotifyLinkError}</p> : null}
    </>
  )
}

function MatchOptions({ candidates, playlistSongCount, selectedId, disabled, onSelect }) {
  return (
    <div className="match-list" role="list">
      {candidates.map((candidate, index) => {
        const selected = selectedId === candidate.spotifyAlbumId
        const facts = candidateFactsLine(candidate, playlistSongCount)
        const compare = candidateCompareHint(candidate, playlistSongCount)
        const lowConfidence = (candidate.breakdown?.overlapScore ?? 1) < 0.45

        return (
          <button
            key={candidate.spotifyAlbumId}
            type="button"
            role="listitem"
            className={`match-option${selected ? ' match-option--selected' : ''}`}
            disabled={disabled || selected}
            onClick={() => onSelect(candidate)}
          >
            <span className="match-option__index" aria-hidden>
              {index + 1}
            </span>
            <CoverImage src={candidate.coverUrl} className="match-option__cover" />
            <span className="match-option__body">
              <span className="match-option__name">{candidate.name}</span>
              {facts ? <span className="match-option__facts">{facts}</span> : null}
              {compare ? (
                <span
                  className={`match-option__compare${lowConfidence ? ' match-option__compare--warn' : ''}`}
                >
                  {compare}
                </span>
              ) : null}
            </span>
            <span className="match-option__action">{selected ? 'Selected' : 'Use this'}</span>
          </button>
        )
      })}
    </div>
  )
}
