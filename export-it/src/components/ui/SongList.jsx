import { faCheck, faCircleExclamation, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getTrackListIconStatus } from '../../utils/status.js'

function TrackStatusIcon({ status }) {
  if (!status) return null

  if (status === 'downloading') {
    return (
      <FontAwesomeIcon
        icon={faSpinner}
        className="fa-icon fa-spin song-status-icon song-status-downloading"
        aria-label="Downloading"
      />
    )
  }
  if (status === 'done') {
    return (
      <FontAwesomeIcon
        icon={faCheck}
        className="fa-icon song-status-icon song-status-done"
        aria-label="Done"
      />
    )
  }
  if (status === 'failed') {
    return (
      <FontAwesomeIcon
        icon={faCircleExclamation}
        className="fa-icon song-status-icon song-status-failed"
        aria-label="Failed"
      />
    )
  }
  return null
}

export default function SongList({ tracks, jobRows, trackOffset = 0, showStatus = false }) {
  if (!tracks?.length) return null

  return (
    <div className="song-list track-list" role="table" aria-label="Songs">
      <div className="song-list-row track-list-row song-list-header track-list-header" role="row">
        <span className="song-list-num track-list-num" role="columnheader">#</span>
        <span className="song-list-title track-list-title" role="columnheader">Title</span>
        <span className="song-list-artist track-list-artist" role="columnheader">Artist</span>
        <span className="song-list-status track-list-status" role="columnheader">Status</span>
      </div>
      {tracks.map((track, i) => {
        const row = jobRows?.[trackOffset + i]
        const status = showStatus ? getTrackListIconStatus(row, true) : null

        return (
          <div key={`${track.sp_id || track.title}-${i}`} className="song-list-row track-list-row" role="row">
            <span className="song-list-num track-list-num" role="cell">{i + 1}</span>
            <span className="song-list-title track-list-title" role="cell" title={track.title}>{track.title}</span>
            <span className="song-list-artist track-list-artist" role="cell" title={track.artists}>{track.artists}</span>
            <span className="song-list-status track-list-status" role="cell">
              <TrackStatusIcon status={status} />
            </span>
          </div>
        )
      })}
    </div>
  )
}
