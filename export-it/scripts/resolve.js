import {
  buildAlbumSearchTerms,
  buildParsed,
  formatDebugCandidate,
  lookupAlbumTracks,
  lookupArtistAlbums,
  MIN_CONFIDENCE,
  pickBestRanked,
  rankCandidates,
  scoreAlbumDetailed,
  scoreArtistDetailed,
  scoreSongDetailed,
  searchAlbumsWithTerms,
  searchArtists,
  searchSongs,
  toAlbumOutput,
  toArtistOutput,
  toSongOutput,
  unknownOutput,
} from './itunes.js'

const USAGE = `Usage:
  npm run resolve -- --song "Tim McGraw" --artist "Taylor Swift"
  npm run resolve -- --album "Speak Now" --artist "Taylor Swift"
  npm run resolve -- --artist "Taylor Swift"
  npm run resolve -- --album "Hamilton"
  npm run resolve -- --album "The Greatest Showman Soundtrack"

Options:
  --song    Song title (requires --artist)
  --album   Album or collection name (artist optional for soundtracks / cast recordings)
  --artist  Artist name (alone returns their catalog)
  --debug   Show search terms, candidates, scores, and rejection reasons`

const FLAG_NAMES = new Set(['--song', '--artist', '--album', '--debug', '--help', '-h'])

function parseArgs(argv) {
  const input = { song: null, artist: null, album: null, debug: false, help: false, positionalError: false }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--debug') {
      input.debug = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      input.help = true
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

function buildQueryObject(input) {
  return {
    ...(input.song ? { song: input.song } : {}),
    ...(input.artist ? { artist: input.artist } : {}),
    ...(input.album ? { album: input.album } : {}),
  }
}

function printDebug({ searchTerms, candidates, chosen = null }) {
  const debug = {
    searchTerms,
    minConfidence: MIN_CONFIDENCE,
    candidates: candidates.slice(0, 10).map(formatDebugCandidate),
    chosen: chosen
      ? {
          collectionName:
            chosen.result.collectionName ?? chosen.result.trackName ?? chosen.result.artistName,
          artistName: chosen.result.artistName ?? null,
          score: Math.round(chosen.score * 100) / 100,
          reasons: chosen.reasons,
        }
      : null,
  }

  console.error(JSON.stringify({ debug }, null, 2))
}

async function resolveSong(input) {
  const query = buildQueryObject(input)
  const parsed = buildParsed(input)
  const searchTerm = `${input.song} ${input.artist}`
  const results = await searchSongs(searchTerm)
  const ranked = rankCandidates(results, scoreSongDetailed, parsed)
  const best = pickBestRanked(ranked)

  if (input.debug) {
    printDebug({ searchTerms: [searchTerm], candidates: ranked, chosen: best })
  }

  if (!best) return unknownOutput(query)
  return toSongOutput(query, best.result, best.confidence)
}

async function resolveAlbum(input) {
  const query = buildQueryObject(input)
  const parsed = buildParsed(input)
  const searchTerms = input.artist
    ? [`${parsed.expandedAlbum ?? input.album} ${input.artist}`]
    : buildAlbumSearchTerms(input.album)
  const results = await searchAlbumsWithTerms(searchTerms)
  const ranked = rankCandidates(results, scoreAlbumDetailed, parsed)
  const best = pickBestRanked(ranked)

  if (input.debug) {
    printDebug({ searchTerms, candidates: ranked, chosen: best })
  }

  if (!best) {
    return unknownOutput(
      query,
      input.artist
        ? undefined
        : 'No confident match found. Try a more specific soundtrack, cast recording, or album name.',
    )
  }

  const tracks = await lookupAlbumTracks(best.result.collectionId)
  if (tracks.length === 0) return unknownOutput(query)

  return toAlbumOutput(query, best.result, tracks, best.confidence)
}

async function resolveArtist(input) {
  const query = buildQueryObject(input)
  const parsed = buildParsed(input)
  const searchTerm = input.artist
  const results = await searchArtists(searchTerm)
  const ranked = rankCandidates(results, scoreArtistDetailed, parsed)
  const bestArtist = pickBestRanked(ranked)

  if (input.debug) {
    printDebug({ searchTerms: [searchTerm], candidates: ranked, chosen: bestArtist })
  }

  if (!bestArtist) return unknownOutput(query)

  const albums = await lookupArtistAlbums(bestArtist.result.artistId)
  if (albums.length === 0) return unknownOutput(query)

  const albumBatch = albums.slice(0, 20)
  const trackLists = await Promise.all(albumBatch.map((album) => lookupAlbumTracks(album.collectionId)))

  const trackMap = new Map()
  for (const tracks of trackLists) {
    for (const track of tracks) {
      const key = `${track.trackName ?? ''}::${track.collectionName ?? ''}`
      if (!trackMap.has(key)) {
        trackMap.set(key, track)
      }
    }
  }

  const songs = [...trackMap.values()].sort((a, b) => {
    const albumCompare = (a.collectionName ?? '').localeCompare(b.collectionName ?? '')
    if (albumCompare !== 0) return albumCompare
    const discCompare = (a.discNumber ?? 1) - (b.discNumber ?? 1)
    if (discCompare !== 0) return discCompare
    return (a.trackNumber ?? 0) - (b.trackNumber ?? 0)
  })

  if (songs.length === 0) return unknownOutput(query)

  return toArtistOutput(query, bestArtist.result, songs, bestArtist.confidence)
}

function detectMode(input) {
  const { song, artist, album } = input

  if (song && artist && !album) return 'song'
  if (album && !song) return 'album'
  if (artist && !song && !album) return 'artist'

  if (song && !artist) {
    return { error: 'Song lookup requires --artist. Example: --song "Tim McGraw" --artist "Taylor Swift"' }
  }
  if (song && album) {
    return { error: 'Use either --song with --artist, or --album with optional --artist, not both.' }
  }

  return { error: 'Provide --song + --artist, --album (+ optional --artist), or --artist alone.' }
}

async function resolveInput(input) {
  const mode = detectMode(input)
  if (mode.error) return unknownOutput(buildQueryObject(input), mode.error)

  if (mode === 'song') return resolveSong(input)
  if (mode === 'album') return resolveAlbum(input)
  return resolveArtist(input)
}

async function main() {
  const argv = process.argv.slice(2)
  const input = parseArgs(argv)

  if (input.positionalError) {
    console.error('Please use flags, example: npm run resolve -- --album "Hamilton"')
    process.exit(1)
  }

  if (input.help || (!input.song && !input.artist && !input.album)) {
    console.error(USAGE)
    process.exit(1)
  }

  try {
    const output = await resolveInput(input)
    console.log(JSON.stringify(output, null, 2))
    process.exit(output.intent === 'unknown' ? 1 : 0)
  } catch (err) {
    console.error(JSON.stringify({ query: buildQueryObject(input), intent: 'unknown', error: err.message }, null, 2))
    process.exit(1)
  }
}

main()
