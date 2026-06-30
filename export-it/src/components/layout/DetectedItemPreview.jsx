import AlbumCard from '../ui/AlbumCard.jsx'

export default function DetectedItemPreview({
  item,
  songsExpanded,
  onToggleSongs,
  jobRows,
  trackOffset = 0,
  showTrackStatus = false,
}) {
  if (!item) return null

  return (
    <AlbumCard
      title={item.name}
      type={item.type}
      trackCount={item.trackCount}
      owner={item.owner}
      artworkUrl={item.coverUrl}
      tracks={item.tracks}
      songsExpanded={songsExpanded}
      onViewSongs={onToggleSongs}
      jobRows={jobRows}
      trackOffset={trackOffset}
      showTrackStatus={showTrackStatus}
    />
  )
}
