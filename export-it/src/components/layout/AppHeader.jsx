import { faSpotify } from '@fortawesome/free-brands-svg-icons'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export default function AppHeader({ displayName, onDisconnect }) {
  if (!displayName) {
    return (
      <header className="app-header">
        <div className="app-brand">
          <img src="/favicon.svg" alt="" className="app-logo" />
          <h1 className="app-title">Export-It</h1>
        </div>
      </header>
    )
  }

  return (
    <header className="app-header">
      <div className="app-brand">
        <img src="/favicon.svg" alt="" className="app-logo" />
        <h1 className="app-title">Export-It</h1>
      </div>
      <button
        type="button"
        className="header-spotify-badge"
        onClick={onDisconnect}
        aria-label={`Disconnect Spotify (${displayName})`}
      >
        <span className="header-spotify-icon" aria-hidden>
          <FontAwesomeIcon icon={faSpotify} className="fa-icon icon-spotify" />
          <FontAwesomeIcon icon={faXmark} className="fa-icon icon-disconnect" />
        </span>
        <span className="header-spotify-label">Connected as {displayName}</span>
      </button>
    </header>
  )
}
