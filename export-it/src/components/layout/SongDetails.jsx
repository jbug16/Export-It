import { getRowBadge, getStatusText } from '../../utils/status.js'
import { IconButton } from '../Buttons.jsx'
import { faRotateRight, faShuffle } from '@fortawesome/free-solid-svg-icons'

export default function SongDetails({ groups, rowMap, hasJob, showActions, onRetry }) {
  return (
    <div className="song-details">
      {groups.map((group) => (
        <div key={group.id} className="song-details-group">
          {groups.length > 1 && (
            <h3 className="song-details-group-title">{group.name}</h3>
          )}
          <table className="track-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th className="col-title">Title</th>
                <th className="col-artist">Artist</th>
                <th className="col-status">Status</th>
                {showActions && <th className="col-actions">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {group.tracks.map(({ track, index }) => {
                const row = rowMap.get(index)
                const badge = getRowBadge(row, hasJob)
                const statusText = getStatusText(row, hasJob)
                const needsAction = badge.variant === 'failed' || badge.variant === 'review' || badge.variant === 'skipped'
                return (
                  <tr key={`${track.sp_id || track.title}-${index}`}>
                    <td className="col-num">{index + 1}</td>
                    <td className="col-title" title={track.title}>{track.title}</td>
                    <td className="col-artist" title={track.artists}>{track.artists}</td>
                    <td className="col-status">
                      <span className={`status-text status-${badge.variant}`}>{statusText}</span>
                    </td>
                    {showActions && (
                      <td className="col-actions">
                        {needsAction && (
                          <IconButton
                            icon={badge.variant === 'failed' ? faRotateRight : faShuffle}
                            label={badge.variant === 'failed' ? 'Retry' : 'Change match'}
                            onClick={() => onRetry(index)}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
