import { Router } from 'express'
import { readPlaylist, matchPlaylist } from '../services/preview.js'
import { resolveSpotifyAlbumUrl } from '../lib/spotdlMeta.js'

const router = Router()

router.post('/read', async (req, res) => {
  const url = req.body?.url
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing url' })
  }

  try {
    const result = await readPlaylist(url)
    if (!result.ok) return res.status(400).json(result)
    res.json(result)
  } catch (err) {
    console.error('[Read]', err)
    res.status(500).json({ ok: false, error: err.message || 'Could not read playlist' })
  }
})

router.post('/match', async (req, res) => {
  const youtube = req.body?.youtube
  if (!youtube?.playlistId || !youtube?.title) {
    return res.status(400).json({ ok: false, error: 'Missing youtube playlist info' })
  }

  try {
    const result = await matchPlaylist(youtube)
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[Match]', err)
    res.status(500).json({ ok: false, error: err.message || 'Metadata match failed' })
  }
})

router.post('/spotify-album', async (req, res) => {
  const url = req.body?.url
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing Spotify album link' })
  }

  try {
    const match = await resolveSpotifyAlbumUrl(url)
    if (!match) {
      return res.status(400).json({ ok: false, error: 'Could not load that Spotify album link' })
    }
    res.json({ ok: true, match })
  } catch (err) {
    console.error('[SpotifyAlbum]', err)
    res.status(500).json({ ok: false, error: err.message || 'Could not load Spotify album' })
  }
})

export default router
