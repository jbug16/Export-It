import { ButtonSecondary, IconButton } from '../Buttons.jsx'
import { faRotateRight, faShuffle } from '@fortawesome/free-solid-svg-icons'
import { getRowBadge, getStatusText } from '../../utils/status.js'

export default function IssueReview({ issues, onRetry, onHide }) {
  return (
    <div className="issue-review">
      <h2 className="issue-review-title">Needs attention</h2>
      <p className="issue-review-count">{issues.length} songs</p>
      <ul className="issue-list">
        {issues.map(({ track, index, row }) => {
          const badge = getRowBadge(row, true)
          const statusText = getStatusText(row, true)
          const reason = row.error || row.status?.replace(/^Fail:\s*/, '') || statusText
          return (
            <li key={index} className="issue-item">
              <div className="issue-item-info">
                <strong className="issue-item-title">{track.title}</strong>
                <span className="issue-item-artist">{track.artists}</span>
                <span className="issue-item-reason">{reason}</span>
              </div>
              <div className="issue-item-actions">
                {badge.variant === 'failed' && (
                  <IconButton icon={faRotateRight} label="Retry" onClick={() => onRetry(index)} />
                )}
                {(badge.variant === 'review' || badge.variant === 'skipped') && (
                  <IconButton icon={faShuffle} label="Change match" onClick={() => onRetry(index)} />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="summary-actions">
        <ButtonSecondary onClick={onHide}>Back</ButtonSecondary>
      </div>
    </div>
  )
}
