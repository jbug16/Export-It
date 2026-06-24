import { Router } from 'express'
import { enqueueJobTask, setQueueMode } from '../jobs/queue.js'
import { jobs, runJob, serializeJob } from '../jobs/processor.js'

const router = Router()

router.post('/', (req, res) => {
  const items = req.body?.items
  const mode = req.body?.mode === 'fast' ? 'fast' : 'safe'

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' })
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  /** @type {import('../jobs/processor.js').JobRecord} */
  const job = {
    id: jobId,
    status: 'queued',
    mode,
    createdAt: new Date().toISOString(),
    items: items.map((item, index) => {
      const canRun = item.spotifyAlbumId || item.useYoutubeTitlesOnly
      return {
        id: `item_${index}_${Date.now()}`,
        youtubeUrl: item.youtubeUrl,
        youtubePlaylistId: item.youtubePlaylistId,
        playlistTitle: item.playlistTitle,
        spotifyAlbumId: item.spotifyAlbumId ?? null,
        spotifyAlbumName: item.spotifyAlbumName ?? null,
        spotifyArtist: item.spotifyArtist ?? null,
        useYoutubeTitlesOnly: Boolean(item.useYoutubeTitlesOnly),
        videoTitles: Array.isArray(item.videoTitles) ? item.videoTitles : [],
        status: canRun ? 'ready' : 'needs_review',
        message: canRun ? 'Queued' : 'Needs album selection',
        downloadCurrent: 0,
        downloadTotal: 0,
        error: null,
        musicFolder: null,
      }
    }),
  }

  jobs.set(jobId, job)
  setQueueMode(mode)

  enqueueJobTask(async () => {
    await runJob(
      jobId,
      job.items.filter((i) => i.spotifyAlbumId || i.useYoutubeTitlesOnly),
    )
  })

  res.json({ jobId })
})

router.get('/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }
  res.json(serializeJob(job))
})

export default router
