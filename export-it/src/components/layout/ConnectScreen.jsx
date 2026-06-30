import { ButtonSpotify } from '../Buttons.jsx'

export default function ConnectScreen({
  status,
  connectError,
  onConnect,
}) {
  return (
    <div className="connect-screen">
      <div className="connect-screen-brand">
        <img src="/favicon.svg" alt="" className="app-logo" />
        <h1 className="app-title">Export-It</h1>
      </div>
      <p className="connect-screen-tagline">
        Download Spotify albums and playlists as MP3s
      </p>
      <div className="spotify-connection-box" aria-label="Spotify connection" aria-busy={status === 'connecting'}>
        {status === 'connecting' ? (
          <>
            <p className="spotify-connection-heading section-title">Connecting to Spotify</p>
            <div className="spotify-connection-btn-slot">
              <ButtonSpotify disabled loading className="spotify-connection-btn">
                Connecting to Spotify…
              </ButtonSpotify>
            </div>
            <p className="spotify-connection-note">Opening Spotify login…</p>
          </>
        ) : (
          <>
            <p className="spotify-connection-heading section-title">Spotify connection required</p>
            <p className="spotify-connection-note meta">
              Connect Spotify to load albums, playlists, and track links.
            </p>
            {connectError && (
              <p className="spotify-connection-error" role="alert">{connectError}</p>
            )}
            <div className="spotify-connection-btn-slot">
              <ButtonSpotify onClick={onConnect} className="spotify-connection-btn">
                Connect Spotify
              </ButtonSpotify>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
