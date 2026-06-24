import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveFfmpegBin, resolveFfmpegLocation } from './lib/ffmpegPath.js'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ffmpegLocation = resolveFfmpegLocation()

export const config = {
  port: Number(process.env.PORT) || 3001,
  jobDelayMs: Number(process.env.JOB_DELAY_MS) || 3000,
  maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS) || 1,
  maxConcurrentJobsFast: 2,
  matchConfidenceThreshold: 0.72,
  ytdlpBin: 'yt-dlp',
  /** Directory passed to yt-dlp --ffmpeg-location */
  ffmpegLocation,
  /** Full path to ffmpeg binary for health checks */
  ffmpegBin: resolveFfmpegBin(),
  paths: {
    root: ROOT,
    data: join(ROOT, 'data'),
    music: join(ROOT, 'Music'),
    temp: join(ROOT, 'downloads', 'tmp'),
    db: join(ROOT, 'data', 'export-it.db'),
  },
}
