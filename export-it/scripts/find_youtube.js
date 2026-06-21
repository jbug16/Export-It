import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { buildQueryObject, detectMode, resolveInput } from './resolve.js'
import { mapWithConcurrency } from './concurrency.js'
import { detectScoringMode, findYouTubeForTrack } from './youtube.js'

const USAGE = `Usage:
  npm run find:youtube -- --song "Tim McGraw" --artist "Taylor Swift"
  npm run find:youtube -- --album "SOUR" --artist "Olivia Rodrigo"
  npm run find:youtube -- --album "Hamilton Original Broadway Cast Recording"

Options:
  --song            Song title (requires --artist)
  --album           Album or collection name (artist optional)
  --artist          Artist name
  --debug           Include full candidates, scores, and rejection reasons
  --concurrency     Parallel album track searches (default: 2)
  --delay-ms        Delay between yt-dlp calls in ms (default: 1000)
  --retries         yt-dlp retries per search (default: 1)
  --limit-tracks    Process only the first N album tracks (for testing)
  --no-cache        Disable .cache/youtube-search/ caching
  --out             Write final JSON to file; print summary to stdout

Environment:
  YTDLP_EXTRA_ARGS  Extra args for yt-dlp (e.g. --cookies-from-browser chrome)`

function parseFindYoutubeArgs(argv) {
  const input = {
    song: null,
    artist: null,
    album: null,
    debug: false,
    help: false,
    positionalError: false,
    concurrency: 2,
    delayMs: 1000,
    retries: 1,
    limitTracks: null,
    noCache: false,
    out: null,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--debug') {
      input.debug = true
      continue
    }

    if (arg === '--no-cache') {
      input.noCache = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      input.help = true
      continue
    }

    if (arg === '--concurrency') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        input.positionalError = true
        break
      }
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        input.positionalError = true
        break
      }
      input.concurrency = Math.min(parsed, 10)
      i += 1
      continue
    }

    if (arg === '--delay-ms') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        input.positionalError = true
        break
      }
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed < 0) {
        input.positionalError = true
        break
      }
      input.delayMs = parsed
      i += 1
      continue
    }

    if (arg === '--retries') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        input.positionalError = true
        break
      }
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed < 0) {
        input.positionalError = true
        break
      }
      input.retries = parsed
      i += 1
      continue
    }

    if (arg === '--limit-tracks') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        input.positionalError = true
        break
      }
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        input.positionalError = true
        break
      }
      input.limitTracks = parsed
      i += 1
      continue
    }

    if (arg === '--out') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        input.positionalError = true
        break
      }
      input.out = value
      i += 1
      continue
    }

    if (arg === '--song' || arg === '--artist' || arg === '--album') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        input.positionalError = true
        break
      }
      input[arg.slice(2)] = value.trim()
      i += 1
      continue
    }

    input.positionalError = true
    break
  }

  return input
}

function buildSongMetadata(resolved) {
  const { result } = resolved
  return {
    artist: result.artist,
    title: result.title,
    album: result.album,
    releaseYear: result.releaseYear,
    trackNumber: result.trackNumber,
    source: result.source,
    confidence: result.confidence,
    ...(result.durationMs != null ? { durationMs: result.durationMs } : {}),
    ...(result.durationSeconds != null ? { durationSeconds: result.durationSeconds } : {}),
  }
}

function buildAlbumMetadata(resolved) {
  const { result } = resolved
  return {
    artist: result.artist,
    album: result.album,
    trackCount: result.trackCount,
  }
}

function buildTrackYouTubeOptions(input, scoringMode) {
  return {
    debug: input.debug,
    scoringMode,
    useCache: !input.noCache,
    delayMs: input.delayMs,
    retries: input.retries,
    onCacheHit: (query) => {
      console.error(`[cache] hit: ${query}`)
    },
  }
}

function buildTrackMeta(track, albumQuery) {
  return {
    artist: track.artist,
    title: track.title,
    album: track.album,
    albumQuery,
    durationSeconds: track.durationSeconds,
  }
}

async function findForSong(resolved, input) {
  const metadata = buildSongMetadata(resolved)
  const scoringMode = detectScoringMode(metadata.album)

  console.error(`[1/1] Searching: ${metadata.title}`)

  const youtube = await findYouTubeForTrack(
    {
      artist: metadata.artist,
      title: metadata.title,
      album: metadata.album,
      albumQuery: resolved.query.album,
      durationSeconds: metadata.durationSeconds,
    },
    buildTrackYouTubeOptions(input, scoringMode),
  )

  return {
    query: resolved.query,
    metadata,
    youtube,
  }
}

async function findForAlbum(resolved, input) {
  const metadata = buildAlbumMetadata(resolved)
  const scoringMode = detectScoringMode(metadata.album)
  const albumQuery = resolved.query.album ?? metadata.album
  const sourceTracks = input.limitTracks
    ? resolved.result.tracks.slice(0, input.limitTracks)
    : resolved.result.tracks
  const trackTotal = sourceTracks.length

  const tracks = await mapWithConcurrency(sourceTracks, input.concurrency, async (track, index) => {
    console.error(`[${index + 1}/${trackTotal}] Searching: ${track.title}`)

    const youtube = await findYouTubeForTrack(
      buildTrackMeta(track, albumQuery),
      buildTrackYouTubeOptions(input, scoringMode),
    )

    if (youtube.error) {
      console.error(`[${index + 1}/${trackTotal}] Error: ${youtube.error}`)
    }

    return {
      globalTrackNumber: track.globalTrackNumber,
      artist: track.artist,
      title: track.title,
      album: track.album,
      ...(track.durationSeconds != null ? { durationSeconds: track.durationSeconds } : {}),
      ...(track.durationMs != null ? { durationMs: track.durationMs } : {}),
      youtube,
    }
  })

  tracks.sort((a, b) => a.globalTrackNumber - b.globalTrackNumber)

  return {
    query: resolved.query,
    metadata: {
      ...metadata,
      ...(input.limitTracks ? { limitedTo: input.limitTracks } : {}),
    },
    tracks,
  }
}

function buildSummary(output) {
  if (output.tracks) {
    const matched = output.tracks.filter((track) => track.youtube?.best).length
    const errors = output.tracks.filter((track) => track.youtube?.error).length
    const parts = [`${output.tracks.length} tracks`, `${matched} matched`]
    if (errors > 0) parts.push(`${errors} errors`)
    return parts.join(', ')
  }

  const err = output.youtube?.error ? ' (error)' : ''
  return output.youtube?.best ? `1 track, 1 matched${err}` : `1 track, 0 matched${err}`
}

async function writeOutput(output, outPath) {
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
}

async function main() {
  const argv = process.argv.slice(2)
  const input = parseFindYoutubeArgs(argv)

  if (input.positionalError) {
    console.error('Please use flags, example: npm run find:youtube -- --song "Tim McGraw" --artist "Taylor Swift"')
    process.exit(1)
  }

  if (input.help || (!input.song && !input.album)) {
    console.error(USAGE)
    process.exit(1)
  }

  const mode = detectMode(input)

  if (mode.error) {
    console.log(JSON.stringify({ query: buildQueryObject(input), intent: 'unknown', error: mode.error }, null, 2))
    process.exit(1)
  }

  if (mode === 'artist') {
    console.log(
      JSON.stringify(
        {
          query: buildQueryObject(input),
          intent: 'unknown',
          error: 'YouTube finder requires --song + --artist or --album (+ optional --artist).',
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  try {
    const resolved = await resolveInput({ ...input, debug: false })

    if (resolved.intent === 'unknown') {
      console.log(JSON.stringify(resolved, null, 2))
      process.exit(1)
    }

    const output =
      resolved.intent === 'song' ? await findForSong(resolved, input) : await findForAlbum(resolved, input)

    if (input.out) {
      await writeOutput(output, input.out)
      console.log(`Wrote ${buildSummary(output)} to ${input.out}`)
    } else {
      console.log(JSON.stringify(output, null, 2))
    }

    process.exit(0)
  } catch (err) {
    console.error(JSON.stringify({ query: buildQueryObject(input), intent: 'unknown', error: err.message }, null, 2))
    process.exit(1)
  }
}

main()
