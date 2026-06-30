import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { IconButton } from './Buttons.jsx'

function formatScore(score) {
  if (!score) return '—'
  return `${Math.round(score * 100)}%`
}

export default function AlternativesModal({ track, options, loading, onClose, onPick }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal alt-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="alt-title">
        <header className="modal-header">
          <div>
            <h2 id="alt-title">Change match</h2>
            <p className="muted">{track?.artists} — {track?.title}</p>
          </div>
          <IconButton icon={faXmark} label="Close" onClick={onClose} className="modal-close" />
        </header>
        <div className="modal-body">
          {loading && <p>Searching YouTube Music…</p>}
          {!loading && options.length === 0 && <p>No alternatives found.</p>}
          {!loading && options.length > 0 && (
            <ul className="alt-list">
              {options.map((opt) => (
                <li key={opt.videoId}>
                  <button type="button" className="alt-item" onClick={() => onPick(opt)}>
                    <strong>{opt.title}</strong>
                    <span>{opt.author || 'Unknown channel'}</span>
                    <span className="alt-score">{formatScore(opt.score)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
