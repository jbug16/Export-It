import { useEffect, useRef } from 'react'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { ButtonSecondary } from '../Buttons.jsx'
import SpotifyLinkRow from './SpotifyLinkRow.jsx'

export default function SpotifyLinksSection({
  rows,
  getItemForRow,
  onUrlChange,
  onPaste,
  onRemove,
  onAddLink,
  onDetect,
  canAddLink,
  expandedSongItems,
  onToggleSongs,
  jobRows,
  itemTrackOffsets,
  showTrackStatus = false,
}) {
  const prevCount = useRef(rows.length)
  const focusRef = useRef(null)

  useEffect(() => {
    if (rows.length > prevCount.current) {
      focusRef.current?.focus()
    }
    prevCount.current = rows.length
  }, [rows.length])

  return (
    <section className="spotify-links" aria-label="Spotify links">
      <div className="spotify-links-body">
        <div className="spotify-links-list">
          {rows.map((row, index) => {
            const item = getItemForRow(row)
            const isLast = index === rows.length - 1
            return (
              <SpotifyLinkRow
                key={row.id}
                row={row}
                item={item}
                inputRef={isLast ? focusRef : undefined}
                onUrlChange={(e) => onUrlChange(row.id, e.target.value)}
                onPaste={(e) => onPaste(row.id, e)}
                onDetect={() => onDetect(row.id)}
                onRemove={() => onRemove(row.id)}
                showRemove={rows.length > 1 || row.url.trim() || row.itemId}
                songsExpanded={item ? expandedSongItems.has(item.id) : false}
                onToggleSongs={item ? () => onToggleSongs(item.id) : undefined}
                jobRows={jobRows}
                trackOffset={item ? (itemTrackOffsets?.get(item.id) ?? 0) : 0}
                showTrackStatus={showTrackStatus}
              />
            )
          })}
        </div>
        <ButtonSecondary icon={faPlus} block onClick={onAddLink} disabled={!canAddLink}>
          Add Spotify link
        </ButtonSecondary>
      </div>
    </section>
  )
}
