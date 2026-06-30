import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { IconButton } from '../Buttons.jsx'
import { Input } from '../ui/index.jsx'
import DetectedItemPreview from './DetectedItemPreview.jsx'

export default function SpotifyLinkRow({
  row,
  item,
  inputRef,
  onUrlChange,
  onPaste,
  onRemove,
  showRemove,
  onDetect,
  songsExpanded,
  onToggleSongs,
  jobRows,
  trackOffset = 0,
  showTrackStatus = false,
}) {
  const hasError = row.error || row.status === 'invalid'

  return (
    <div className="spotify-link-item">
      <div className={`spotify-link-row-input${showRemove ? '' : ' spotify-link-row-input--solo'}`}>
        <Input
          ref={inputRef}
          type="url"
          error={hasError}
          placeholder="https://open.spotify.com/album/…"
          value={row.url}
          onChange={onUrlChange}
          onPaste={onPaste}
          onBlur={() => {
            if (row.url.trim() && row.status !== 'detecting' && row.status !== 'ready') {
              onDetect?.()
            }
          }}
          aria-label="Spotify link"
        />
        {showRemove && (
          <IconButton
            icon={faTrash}
            label="Remove link"
            variant="danger"
            onClick={onRemove}
          />
        )}
      </div>
      {row.status === 'detecting' && (
        <p className="row-status small-body muted">Detecting…</p>
      )}
      {row.error && (
        <p className="row-error small-body text-error">{row.error}</p>
      )}
      {item && row.status === 'ready' && (
        <DetectedItemPreview
          item={item}
          songsExpanded={songsExpanded}
          onToggleSongs={onToggleSongs}
          jobRows={jobRows}
          trackOffset={trackOffset}
          showTrackStatus={showTrackStatus}
        />
      )}
    </div>
  )
}
