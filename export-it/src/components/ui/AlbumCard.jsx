import { ButtonSecondary } from '../Buttons.jsx'
import { formatTypeLabel } from '../../utils/status.js'
import SongList from './SongList.jsx'

export default function AlbumCard({
  title,
  type,
  trackCount,
  owner,
  artworkUrl,
  tracks = [],
  songsExpanded = false,
  onViewSongs,
  jobRows,
  trackOffset = 0,
  showTrackStatus = false,
  statusBadge = null,
}) {
  const typeLabel = formatTypeLabel(type)
  const songWord = trackCount === 1 ? 'song' : 'songs'
  const hasTracks = tracks.length > 0

  return (
    <div className="detected-preview">
      <div className="album-card">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="album-card-art" />
        ) : (
          <div className="album-card-art album-card-art-placeholder" aria-hidden />
        )}
        <div className="album-card-info">
          <p className="card-title album-card-title">{title}</p>
          <div className="album-card-meta">
            {type === 'track' ? (
              <>
                {owner && <span>{owner}</span>}
                <span>{typeLabel}</span>
              </>
            ) : (
              <>
                <span>{typeLabel}</span>
                <span>{trackCount} {songWord}</span>
              </>
            )}
          </div>
          {statusBadge}
        </div>
        {hasTracks && onViewSongs && (
          <ButtonSecondary size="sm" onClick={onViewSongs}>
            {songsExpanded ? 'Hide songs' : 'View songs'}
          </ButtonSecondary>
        )}
      </div>
      {songsExpanded && hasTracks && (
        <SongList
          tracks={tracks}
          jobRows={jobRows}
          trackOffset={trackOffset}
          showStatus={showTrackStatus}
        />
      )}
    </div>
  )
}
