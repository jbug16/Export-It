import { parseYoutubeUrl } from './youtubeLinks.js'
import { runYtDlp } from './ytdlp.js'

/**
 * @param {string} url
 * @returns {Promise<
 *   | { ok: false, error: string }
 *   | { ok: true, playlistId: string, cleanUrl: string, title: string, videoCount: number, videos: { index: number, title: string, duration: number | null, id: string }[] }
 * >}
 */
export async function extractPlaylist(url) {
  const parsed = parseYoutubeUrl(url)
  if (!parsed.valid || parsed.type !== 'playlist') {
    return { ok: false, error: 'Invalid YouTube playlist link' }
  }

  const result = await runYtDlp(
    ['-J', '--flat-playlist', parsed.cleanUrl],
    { timeoutMs: 120_000 },
  )

  if (result.code === null) {
    return { ok: false, error: result.error || 'Failed to run yt-dlp' }
  }
  if (result.code !== 0) {
    return { ok: false, error: result.stderr.trim() || 'Could not read playlist' }
  }

  let data
  try {
    data = JSON.parse(result.stdout)
  } catch {
    return { ok: false, error: 'Invalid playlist response from yt-dlp' }
  }

  const playlistId = data.id || parsed.cleanUrl.split('list=')[1]?.split('&')[0] || ''
  const entries = (data.entries || []).filter(Boolean)

  return {
    ok: true,
    playlistId,
    cleanUrl: parsed.cleanUrl,
    title: (data.title || 'Untitled Playlist').replace(/^[\s\-–—•]+/, '').trim(),
    videoCount: entries.length,
    videos: entries.map((entry, i) => ({
      index: entry.playlist_index ?? i + 1,
      title: entry.title || `Track ${i + 1}`,
      duration: entry.duration ?? null,
      id: entry.id,
    })),
  }
}

export { parseYoutubeUrl } from './youtubeLinks.js'
