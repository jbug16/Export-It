import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { mkdirSync } from 'node:fs'
import { config } from './config.js'
import healthRoutes from './routes/health.js'
import playlistRoutes from './routes/playlists.js'
import jobRoutes from './routes/jobs.js'

mkdirSync(config.paths.music, { recursive: true })
mkdirSync(config.paths.temp, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.use('/api/health', healthRoutes)
app.use('/api/playlists', playlistRoutes)
app.use('/api/jobs', jobRoutes)

app.use((err, _req, res, _next) => {
  console.error('[Server]', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(config.port, () => {
  console.log(`Export-It listening on http://localhost:${config.port}`)
  if (config.ffmpegLocation) {
    console.log(`ffmpeg: ${config.ffmpegLocation}`)
  } else {
    console.warn('ffmpeg not found — downloads will fail until you install it (brew install ffmpeg)')
  }
})
