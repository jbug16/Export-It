/**
 * @param {string | null | undefined} message
 * @returns {{ text: string, fix: string | null }}
 */
export function friendlyError(message) {
  if (!message) return { text: 'Something went wrong.', fix: null }

  const m = message.toLowerCase()

  if (m.includes('ffmpeg')) {
    return {
      text: 'Audio conversion needs ffmpeg.',
      fix: 'Install it with brew install ffmpeg, then restart the app.',
    }
  }
  if (m.includes('spotdl') && m.includes('not installed')) {
    return {
      text: 'Album matching needs spotDL.',
      fix: 'Install it with pipx install spotdl, then restart the app.',
    }
  }
  if (m.includes('yt-dlp') || m.includes('ytdlp')) {
    return {
      text: 'Downloading needs yt-dlp.',
      fix: 'Install it with brew install yt-dlp, then restart the app.',
    }
  }
  if (m.includes('video unavailable')) {
    return {
      text: 'Some songs in this playlist are unavailable on YouTube.',
      fix: 'Remove unavailable videos from the playlist, or skip data sync.',
    }
  }
  if (m.includes('invalid') && m.includes('playlist')) {
    return {
      text: 'That link does not look like a YouTube playlist.',
      fix: 'Copy the full URL from the playlist page. It should include list=.',
    }
  }
  if (m.includes('no matching albums')) {
    return {
      text: 'Could not find a matching Spotify album.',
      fix: 'Pick a match below, or skip data sync.',
    }
  }
  if (m.includes('metadata search') || m.includes('preview failed')) {
    return {
      text: 'Album lookup took too long or failed.',
      fix: 'Try again, pick a match, or skip data sync.',
    }
  }

  return { text: message, fix: null }
}
