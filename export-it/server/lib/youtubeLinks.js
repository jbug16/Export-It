const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])

/**
 * @param {string} rawUrl
 */
export function parseYoutubeUrl(rawUrl) {
  const trimmed = String(rawUrl ?? '').trim()
  if (!trimmed) return { valid: false }

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false }
  }

  const host = parsed.hostname.replace(/^www\./, '')
  const isYoutube =
    YOUTUBE_HOSTS.has(parsed.hostname) ||
    host === 'youtube.com' ||
    host === 'youtu.be' ||
    host === 'music.youtube.com'

  if (!isYoutube) return { valid: false }

  if (parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    if (!id) return { valid: false }
    return { valid: true, type: 'video', cleanUrl: `https://www.youtube.com/watch?v=${id}`, id }
  }

  const playlistId = parsed.searchParams.get('list')
  if (parsed.pathname === '/playlist' && playlistId) {
    return {
      valid: true,
      type: 'playlist',
      cleanUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      id: playlistId,
    }
  }

  const videoId = parsed.searchParams.get('v')
  if (videoId) {
    if (playlistId) {
      return {
        valid: true,
        type: 'playlist',
        cleanUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        id: playlistId,
      }
    }
    return {
      valid: true,
      type: 'video',
      cleanUrl: `https://www.youtube.com/watch?v=${videoId}`,
      id: videoId,
    }
  }

  return { valid: false }
}
