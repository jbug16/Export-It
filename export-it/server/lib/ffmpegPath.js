import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const COMMON_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin']

function hasFfmpegPair(dir) {
  return existsSync(join(dir, 'ffmpeg')) && existsSync(join(dir, 'ffprobe'))
}

/**
 * yt-dlp needs --ffmpeg-location as a directory (or full binary path), not "ffmpeg".
 * @returns {string | null} Directory containing ffmpeg and ffprobe
 */
export function resolveFfmpegLocation() {
  const candidates = []

  if (process.env.FFMPEG_PATH) {
    const envPath = process.env.FFMPEG_PATH
    if (hasFfmpegPair(envPath)) {
      return envPath
    }
    if (envPath.endsWith('ffmpeg') && existsSync(envPath)) {
      const dir = dirname(envPath)
      if (hasFfmpegPair(dir)) return dir
    }
  }

  try {
    const fromPath = execFileSync('which', ['ffmpeg'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: [...COMMON_BIN_DIRS, process.env.PATH].filter(Boolean).join(':'),
      },
    }).trim()
    if (fromPath) candidates.push(fromPath)
  } catch {
    // which failed — try common install locations below
  }

  for (const dir of COMMON_BIN_DIRS) {
    candidates.push(join(dir, 'ffmpeg'))
  }

  for (const candidate of candidates) {
    if (!candidate || !existsSync(candidate)) continue
    const dir = dirname(candidate)
    if (hasFfmpegPair(dir)) return dir
  }

  return null
}

/**
 * @returns {string | null}
 */
export function resolveFfmpegBin() {
  const dir = resolveFfmpegLocation()
  return dir ? join(dir, 'ffmpeg') : null
}
