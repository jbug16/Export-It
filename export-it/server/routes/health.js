import { Router } from 'express'
import { checkFfmpeg, checkYtDlp } from '../lib/ytdlp.js'
import { checkSpotdlInstalled, getPreviewTimingHints } from '../lib/spotdlMeta.js'
import { getQueueStats } from '../jobs/queue.js'
import { config } from '../config.js'

const router = Router()

router.get('/', async (_req, res) => {
  const [ytdlp, ffmpeg, spotdl] = await Promise.all([
    checkYtDlp(),
    checkFfmpeg(),
    checkSpotdlInstalled(),
  ])
  res.json({
    ok: true,
    ytdlp,
    ffmpeg,
    spotdl,
    queue: getQueueStats(),
    outputFolder: config.paths.music,
    timing: getPreviewTimingHints(),
  })
})

export default router
