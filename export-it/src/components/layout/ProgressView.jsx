import { ButtonPrimary } from '../Buttons.jsx'
import { SummaryActions, SummaryCard, SummaryField } from './SummaryCard.jsx'

export default function ProgressView({
  progress,
  progressPct,
  onStop,
}) {
  if (!progress) return null

  const {
    itemName,
    itemSubtitle,
    coverUrl,
    trackIndex,
    trackTotal,
    overallDownloaded,
    overallTotal,
  } = progress

  const songWord = overallTotal === 1 ? 'song' : 'songs'

  return (
    <SummaryCard title="Downloading" ariaLabel="Download progress" className="progress-view">
      <div className="progress-current-item">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="progress-current-art" />
        ) : (
          <div className="progress-current-art progress-current-art-placeholder" aria-hidden />
        )}
        <div className="progress-current-info">
          <p className="card-title progress-item-title">{itemName}</p>
          {itemSubtitle && (
            <p className="progress-item-subtitle meta">{itemSubtitle}</p>
          )}
          <p className="progress-item-meta meta">
            Track {trackIndex} of {trackTotal}
          </p>
        </div>
      </div>

      <SummaryField
        label="Overall progress"
        value={`${overallDownloaded} of ${overallTotal} ${songWord} downloaded`}
      />

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Download progress"
      >
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <SummaryActions>
        <ButtonPrimary onClick={onStop} block>Stop</ButtonPrimary>
      </SummaryActions>
    </SummaryCard>
  )
}
