const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])

/**
 * @param {string} rawUrl
 * @returns {{ valid: false } | { valid: true, cleanUrl: string, type: 'playlist' | 'video' }}
 */
export function parseYoutubeUrl(rawUrl) {
  const trimmed = String(rawUrl ?? '').trim()
  if (!trimmed) {
    return { valid: false }
  }

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false }
  }

  const host = parsed.hostname.replace(/^www\./, '')
  const isYoutubeHost =
    YOUTUBE_HOSTS.has(parsed.hostname) ||
    host === 'youtube.com' ||
    host === 'youtu.be' ||
    host === 'music.youtube.com'

  if (!isYoutubeHost) {
    return { valid: false }
  }

  if (parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    if (!id) return { valid: false }
    return {
      valid: true,
      type: 'video',
      cleanUrl: `https://www.youtube.com/watch?v=${id}`,
    }
  }

  const playlistId = parsed.searchParams.get('list')
  if (parsed.pathname === '/playlist' && playlistId) {
    return {
      valid: true,
      type: 'playlist',
      cleanUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
    }
  }

  const videoId = parsed.searchParams.get('v')
  if (videoId) {
    if (playlistId) {
      return {
        valid: true,
        type: 'playlist',
        cleanUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      }
    }
    return {
      valid: true,
      type: 'video',
      cleanUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }
  }

  return { valid: false }
}

/**
 * @param {string} type
 * @returns {string}
 */
export function youtubeTypeLabel(type) {
  return type === 'playlist' ? 'playlist' : 'video'
}

/**
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * @param {string} title
 * @returns {string}
 */
export function folderNameFromTitle(title) {
  return sanitizeFolderName(title) || 'youtube-download'
}
