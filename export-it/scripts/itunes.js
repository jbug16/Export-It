const SEARCH_URL = 'https://itunes.apple.com/search'
const LOOKUP_URL = 'https://itunes.apple.com/lookup'
const SOURCE = 'iTunes Search API'
export const MIN_CONFIDENCE = 0.65

export const COLLECTION_KEYWORDS =
  /\b(soundtrack|score|cast recording|broadway|musical|ost|original cast|volume|awesome mix)\b/i

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'of', 'or'])

const PHRASE_STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'of', 'or', 'from'])

const COLLECTION_STOP_WORDS = new Set([
  'soundtrack',
  'score',
  'original',
  'broadway',
  'off',
  'cast',
  'recording',
  'musical',
  'ost',
  'volume',
  'album',
  'motion',
  'picture',
  'game',
  'alpha',
  'beta',
  'from',
  'music',
])

const BAD_EDITION_TERMS = [
  'sing-a-long',
  'sing a long',
  'sing along',
  'karaoke',
  'instrumental',
  'tribute',
  'lullaby',
  'cover',
  'remix',
  'commentary',
  'behind the scenes',
  'live',
]

const OFFICIAL_SOUNDTRACK_MARKERS = [
  'original motion picture soundtrack',
  'original soundtrack',
  'original game soundtrack',
  'music from the motion picture',
  'music from the film',
]

const OFFICIAL_CAST_MARKERS = [
  'original broadway cast recording',
  'original off broadway cast recording',
  'original cast recording',
  'world premiere cast recording',
]

const UNWANTED_COLLECTION_EDITIONS = [
  { term: 'one piano', message: 'query did not ask for piano version' },
  { term: 'solo piano', message: 'query did not ask for piano version' },
  { term: 'for solo piano', message: 'query did not ask for piano version' },
  { term: 'soundtrack for piano', message: 'query did not ask for piano version' },
  { term: 'for piano', message: 'query did not ask for piano version' },
  { term: 'a cappella', message: 'query did not ask for a cappella version' },
  { term: 'acapella', message: 'query did not ask for a cappella version' },
  { term: 'reimagined', message: 'candidate is reimagined edition' },
  { term: 'medley', message: 'query did not ask for medley version' },
  { term: 'relift', message: 'query did not ask for relift version' },
  { term: 'remix', message: 'query did not ask for remix version' },
  { term: 'instrumental', message: 'query did not ask for instrumental version' },
  { term: 'karaoke', message: 'query did not ask for karaoke version' },
  { term: 'tribute', message: 'query did not ask for tribute version' },
  { term: 'lullaby', message: 'query did not ask for lullaby version' },
  { term: 'covers', message: 'query did not ask for cover version' },
  { term: 'cover', message: 'query did not ask for cover version' },
  { term: 'piano', message: 'query did not ask for piano version' },
  { term: 'keyboard', message: 'query did not ask for keyboard version' },
  { term: 'keyboards', message: 'query did not ask for keyboard version' },
  { term: 'music box', message: 'query did not ask for music box version' },
  { term: 'lofi', message: 'query did not ask for lofi version' },
  { term: 'lo fi', message: 'query did not ask for lo-fi version' },
  { term: 'nostalgic', message: 'query did not ask for nostalgic version' },
  { term: 'chiptune', message: 'query did not ask for chiptune version' },
  { term: '8 bit', message: 'query did not ask for 8-bit version' },
  { term: 'acoustic guitar', message: 'query did not ask for acoustic guitar version' },
  { term: 'retrogame', message: 'query did not ask for retrogame version' },
  { term: 'single', message: 'query did not ask for single release' },
]

const NON_ENGLISH_LANGUAGE_TERMS = [
  'japanese',
  'korean',
  'mandarin',
  'chinese',
  'german',
  'deutsch',
  'danish',
  'dutch',
  'nederlandstalige',
  'bahasa',
  'reo maori',
  'maori',
  'georgian',
]

const CAST_SUFFIX_PATTERNS = [
  /\boriginal off broadway cast recording\b/gi,
  /\boriginal broadway cast recording\b/gi,
  /\boriginal cast recording\b/gi,
  /\bworld premiere cast recording\b/gi,
  /\bthe musical world premiere cast recording\b/gi,
  /\bthe musical cast recording\b/gi,
  /\bcast recording\b/gi,
  /\bobc recording\b/gi,
  /\bsoundtrack\b/gi,
]

const CAST_RECORDING_QUERY_PATTERN =
  /\b(cast recording|obc|obcr|oobcr|off broadway|broadway)\b/i

const CAST_RECORDING_MARKERS = [
  'cast recording',
  'original broadway cast',
  'original off broadway cast',
  'world premiere cast',
  'original cast recording',
]

const UNWANTED_MEDIA_TERMS = [
  { term: 'riverdale', castMessage: 'query requested cast recording, but candidate is television soundtrack' },
  { term: 'glee', castMessage: 'query requested cast recording, but candidate is a TV cover recording' },
  { term: 'original television soundtrack', castMessage: 'query requested cast recording, but candidate is television soundtrack' },
  { term: 'television soundtrack', castMessage: 'query requested cast recording, but candidate is television soundtrack' },
  { term: 'special episode', castMessage: 'query requested cast recording, but candidate is television soundtrack' },
  { term: 'episode', castMessage: 'query requested cast recording, but candidate is television soundtrack' },
  { term: 'a cappella', castMessage: 'query requested cast recording, but candidate is a cover recording' },
  { term: 'solo piano', castMessage: 'query requested cast recording, but candidate is a cover recording' },
  { term: 'karaoke', castMessage: 'query requested cast recording, but candidate is karaoke' },
  { term: 'instrumental', castMessage: 'query requested cast recording, but candidate is instrumental' },
  { term: 'lullaby', castMessage: 'query requested cast recording, but candidate is a cover recording' },
  { term: 'tribute', castMessage: 'query requested cast recording, but candidate is a tribute recording' },
  { term: 'cover', castMessage: 'query requested cast recording, but candidate is a cover recording' },
]

export function normalize(text) {
  return (text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CAST_ABBREVIATIONS = [
  [/\bOBC recording\b/gi, 'Original Broadway Cast Recording'],
  [/\bOOBCR\b/gi, 'Original Off-Broadway Cast Recording'],
  [/\bOBOC\b/gi, 'Original Off-Broadway Cast Recording'],
  [/\bOBCR\b/gi, 'Original Broadway Cast Recording'],
  [/\bOBC\b/gi, 'Original Broadway Cast Recording'],
  [/\bOCR\b/gi, 'Original Cast Recording'],
]

export function queryRequestsCastRecording(album) {
  return CAST_RECORDING_QUERY_PATTERN.test(expandCastAbbreviations(album ?? ''))
}

function queryAllowsSingleOrEp(queryNorm) {
  return /\b(single|ep)\b/.test(queryNorm)
}

function isSingleOrEpRelease(collectionName, queryNorm) {
  const name = collectionName ?? ''
  const nameNorm = normalize(name)
  if (queryAllowsSingleOrEp(queryNorm)) return false

  if (/\-\s*single\b/i.test(name)) return true
  if (/\-\s*ep\b/i.test(name)) return true
  if (nameNorm.endsWith(' single')) return true
  if (nameNorm.endsWith(' ep')) return true
  return false
}

function albumTrackCountBonus(trackCount, reasons) {
  if (trackCount > 5) {
    reasons.push(`bonus: full album track count (${trackCount})`)
    return 0.12
  }
  if (trackCount > 3) {
    reasons.push('bonus: reasonable track count')
    return 0.04
  }
  return 0
}

function albumTrackCountPenalty(trackCount, parsed, reasons) {
  if (!parsed.artist || parsed.song) return 0

  if (trackCount <= 2) {
    reasons.push(`penalty: very low track count (${trackCount}) for album query`)
    return 0.35
  }
  if (trackCount <= 5) {
    reasons.push(`penalty: low track count (${trackCount}) for album query`)
    return 0.15
  }
  return 0
}

export function queryRequestsSoundtrack(album) {
  if (queryRequestsCastRecording(album)) return false
  return /\b(soundtrack|ost|score|awesome mix)\b/i.test(album ?? '')
}

function queryIsCollectionStyle(album) {
  if (!album) return false
  return COLLECTION_KEYWORDS.test(album) || /\b(awesome mix|vol\.?\s*\d+)\b/i.test(album)
}

function queryIsCollectionEditionStrict(parsed) {
  return parsed.isCastRecordingQuery || parsed.isSoundtrackQuery || parsed.isCollectionQuery
}

function collectionQueryLabel(parsed) {
  if (parsed.isCastRecordingQuery) return 'cast recording'
  if (parsed.isSoundtrackQuery) return 'soundtrack'
  return 'collection'
}

function hasOfficialSoundtrackWording(collectionNorm) {
  return OFFICIAL_SOUNDTRACK_MARKERS.some((marker) => collectionNorm.includes(marker))
}

function hasOfficialCastWording(collectionNorm) {
  return OFFICIAL_CAST_MARKERS.some((marker) => collectionNorm.includes(marker))
}

function isVariousArtists(artistName) {
  return normalize(artistName).includes('various artists')
}

function collectionContainsTerm(collectionNorm, termNorm) {
  const pattern = new RegExp(`\\b${termNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  return pattern.test(collectionNorm)
}

function formatEditionRejection(parsed, message) {
  if (message === 'candidate is reimagined edition') {
    return 'rejected: candidate is reimagined edition'
  }
  const label = collectionQueryLabel(parsed)
  const detail = message.replace('query did not ask for ', '')
  return `rejected: ${label} query did not ask for ${detail}`
}

export function checkUnwantedEditionRequirements(parsed, result) {
  if (!queryIsCollectionEditionStrict(parsed)) {
    return { passed: true, reason: null }
  }

  const queryNorm = normalize(parsed.raw)
  const haystack = `${normalize(result.collectionName ?? '')} ${normalize(result.artistName ?? '')}`

  for (const { term, message } of UNWANTED_COLLECTION_EDITIONS) {
    const termNorm = normalize(term)
    if (!collectionContainsTerm(haystack, termNorm)) continue
    if (queryAllowsTerm(queryNorm, term)) continue

    return { passed: false, reason: formatEditionRejection(parsed, message) }
  }

  return { passed: true, reason: null }
}

export function checkLanguageEditionRequirements(parsed, result) {
  if (!parsed.isSoundtrackQuery && !parsed.isCollectionQuery) {
    return { passed: true, reason: null }
  }

  const queryNorm = normalize(parsed.raw)
  const haystack = `${normalize(result.collectionName ?? '')} ${normalize(result.artistName ?? '')}`

  for (const term of NON_ENGLISH_LANGUAGE_TERMS) {
    if (!haystack.includes(term)) continue
    if (queryNorm.includes(term)) continue

    return {
      passed: false,
      reason: `rejected: soundtrack query did not ask for ${term} edition`,
    }
  }

  return { passed: true, reason: null }
}

export function extractBaseTitle(album) {
  let text = expandCastAbbreviations(album ?? '').replace(/-/g, ' ')

  for (const pattern of CAST_SUFFIX_PATTERNS) {
    text = text.replace(pattern, ' ')
  }

  text = text.replace(/\s+/g, ' ').trim()
  const withMusical = /\bthe musical\b/i.test(text) ? text : null
  const baseTitle = text.replace(/\bthe musical\b/gi, '').replace(/\s+/g, ' ').trim() || text

  return { baseTitle, withMusical }
}

function collectionIsCastRecording(collectionNorm) {
  return CAST_RECORDING_MARKERS.some((marker) => collectionNorm.includes(marker))
}

function queryAllowsTerm(queryNorm, term) {
  return queryNorm.includes(normalize(term))
}

export function checkCastRecordingRequirements(parsed, result) {
  if (!queryRequestsCastRecording(parsed.album)) {
    return { passed: true, reason: null }
  }

  const queryNorm = normalize(parsed.raw)
  const collectionNorm = normalize(result.collectionName ?? '')
  const artistNorm = normalize(result.artistName ?? '')
  const haystack = `${collectionNorm} ${artistNorm}`

  for (const { term, castMessage } of UNWANTED_MEDIA_TERMS) {
    const termNorm = normalize(term)
    if (haystack.includes(termNorm) && !queryAllowsTerm(queryNorm, term)) {
      return { passed: false, reason: castMessage }
    }
  }

  if (!collectionIsCastRecording(collectionNorm)) {
    return {
      passed: false,
      reason: 'query requested cast recording, but candidate is not a cast recording',
    }
  }

  return { passed: true, reason: 'cast recording requirement passed' }
}

export function expandCastAbbreviations(album) {
  let text = album ?? ''
  for (const [pattern, replacement] of CAST_ABBREVIATIONS) {
    text = text.replace(pattern, replacement)
  }
  return text.trim()
}

export function buildAlbumSearchTerms(album) {
  if (!queryRequestsCastRecording(album)) {
    return [expandCastAbbreviations(album)]
  }

  const expanded = expandCastAbbreviations(album)
  const { baseTitle, withMusical } = extractBaseTitle(album)
  const terms = new Set([
    expanded,
    `${baseTitle} Original Broadway Cast Recording`,
    `${baseTitle} Original Off-Broadway Cast Recording`,
    `${baseTitle} Original Cast Recording`,
    `${baseTitle} World Premiere Cast Recording`,
    `${baseTitle} The Musical Cast Recording`,
    `${baseTitle} Cast Recording`,
    `${baseTitle} The Musical World Premiere Cast Recording`,
  ])

  if (withMusical && withMusical !== baseTitle) {
    terms.add(`${withMusical} World Premiere Cast Recording`)
    terms.add(`${withMusical} Cast Recording`)
  }

  return [...terms]
    .map((term) => term.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function importantWords(text, { collection = false } = {}) {
  const stop = collection ? new Set([...STOP_WORDS, ...COLLECTION_STOP_WORDS]) : STOP_WORDS
  return normalize(text)
    .split(' ')
    .filter((word) => word && !stop.has(word))
}

export function phraseTokens(text) {
  return normalize(text)
    .split(' ')
    .filter((word) => word && !PHRASE_STOP_WORDS.has(word))
}

export function phraseTokensMatch(queryText, candidateText) {
  const query = phraseTokens(queryText)
  const candidate = phraseTokens(candidateText)

  if (query.length === 0) {
    return { matched: false, missing: ['(empty query)'] }
  }

  let candidateIndex = 0
  const missing = []

  for (const token of query) {
    let found = false
    for (let i = candidateIndex; i < candidate.length; i += 1) {
      if (candidate[i] === token) {
        candidateIndex = i + 1
        found = true
        break
      }
    }
    if (!found) missing.push(token)
  }

  return { matched: missing.length === 0, missing }
}

function extractImportantNumbers(text) {
  const norm = normalize(text.replace(/\./g, ' '))
  const numbers = []

  for (const match of norm.matchAll(/\b(?:vol|volume)\s*(\d+)\b/g)) {
    numbers.push({ kind: 'vol', value: match[1] })
  }

  for (const match of norm.matchAll(/\b(?!vol|volume|mix|no|track|part|disc|cd)(\w+)\s+(\d+)\b/g)) {
    if (!numbers.some((entry) => entry.value === match[2])) {
      numbers.push({ kind: 'sequel', value: match[2] })
    }
  }

  return numbers
}

function numberValues(numbers) {
  return [...new Set(numbers.map((entry) => entry.value))]
}

function checkNumberRequirements(parsed, result) {
  const queryNumbers = numberValues(extractImportantNumbers(parsed.album ?? ''))
  const candidateNumbers = numberValues(extractImportantNumbers(result.collectionName ?? ''))

  if (queryNumbers.length === 0) {
    return { passed: true, reason: null, extraCandidateNumbers: candidateNumbers }
  }

  const missing = queryNumbers.filter((value) => !candidateNumbers.includes(value))
  if (missing.length > 0) {
    return {
      passed: false,
      reason: `album title missing required number(s): ${missing.join(', ')}`,
      extraCandidateNumbers: [],
    }
  }

  return { passed: true, reason: null, extraCandidateNumbers: candidateNumbers.filter((v) => !queryNumbers.includes(v)) }
}

function numberMismatchPenalty(parsed, result, reasons) {
  const queryNumbers = numberValues(extractImportantNumbers(parsed.album ?? ''))
  const candidateNumbers = numberValues(extractImportantNumbers(result.collectionName ?? ''))
  let penalty = 0

  if (queryNumbers.length > 0) {
    const extra = candidateNumbers.filter((value) => !queryNumbers.includes(value))
    if (extra.length > 0) {
      penalty += 0.3
      reasons.push(`penalty: candidate has different volume/sequel number (${extra.join(', ')}) than query (${queryNumbers.join(', ')})`)
    }
    return penalty
  }

  if (candidateNumbers.length > 0) {
    penalty += 0.2
    reasons.push(`penalty: candidate has sequel/volume number (${candidateNumbers.join(', ')}) but query does not`)
  }

  return penalty
}

function wordCoverage(requiredWords, haystackNorm) {
  if (requiredWords.length === 0) return 0
  const matched = requiredWords.filter((word) => haystackNorm.includes(word))
  return matched.length / requiredWords.length
}

function queryAllowsBadEdition(queryNorm, text) {
  const lower = text.toLowerCase()
  return BAD_EDITION_TERMS.some((term) => lower.includes(term) && queryNorm.includes(normalize(term)))
}

function badEditionPenalty(text, queryNorm, reasons) {
  const lower = text.toLowerCase()
  let penalty = 0

  for (const term of BAD_EDITION_TERMS) {
    if (lower.includes(term) && !queryAllowsBadEdition(queryNorm, term)) {
      penalty += 0.45
      reasons.push(`penalty: unwanted edition term "${term}"`)
    }
  }

  return penalty
}

export function passesSongHardGate(parsed, result) {
  const songNorm = normalize(parsed.song ?? '')
  const artistNorm = normalize(parsed.artist ?? '')
  const trackNorm = normalize(result.trackName ?? '')
  const artistResult = normalize(result.artistName ?? '')

  if (!songNorm || !artistNorm) return { passed: false, reason: 'missing song or artist' }

  if (artistResult !== artistNorm && !artistResult.includes(artistNorm) && !artistNorm.includes(artistResult)) {
    return { passed: false, reason: 'artist does not strongly match' }
  }

  const songWords = importantWords(parsed.song)
  if (songWords.length === 0) return { passed: false, reason: 'no meaningful song words' }

  const coverage = wordCoverage(songWords, trackNorm)
  if (coverage < 0.85) {
    return { passed: false, reason: `song words only ${Math.round(coverage * 100)}% present in track title` }
  }

  if (!trackNorm.includes(songNorm) && songNorm !== trackNorm && coverage < 1) {
    return { passed: false, reason: 'track title does not strongly match requested song' }
  }

  return { passed: true, reason: 'song and artist hard gates passed' }
}

export function passesAlbumHardGate(parsed, result) {
  const albumNorm = normalize(parsed.album ?? '')
  const artistNorm = normalize(parsed.artist ?? '')

  if (!albumNorm) return { passed: false, reason: 'missing album title' }

  const { baseTitle } = extractBaseTitle(parsed.album)
  const phraseMatch = phraseTokensMatch(baseTitle, result.collectionName ?? '')
  if (!phraseMatch.matched) {
    return {
      passed: false,
      reason: `album title missing required token(s): ${phraseMatch.missing.join(', ')}`,
    }
  }

  const numberCheck = checkNumberRequirements(parsed, result)
  if (!numberCheck.passed) {
    return { passed: false, reason: numberCheck.reason }
  }

  if (artistNorm) {
    const resultArtist = normalize(result.artistName ?? '')
    if (resultArtist !== artistNorm && !resultArtist.includes(artistNorm) && !artistNorm.includes(resultArtist)) {
      return { passed: false, reason: 'artist does not strongly match' }
    }
  }

  const castCheck = checkCastRecordingRequirements(parsed, result)
  if (!castCheck.passed) {
    return { passed: false, reason: castCheck.reason }
  }

  const editionCheck = checkUnwantedEditionRequirements(parsed, result)
  if (!editionCheck.passed) {
    return { passed: false, reason: editionCheck.reason }
  }

  const languageCheck = checkLanguageEditionRequirements(parsed, result)
  if (!languageCheck.passed) {
    return { passed: false, reason: languageCheck.reason }
  }

  return { passed: true, reason: 'album hard gate passed' }
}

export function passesArtistHardGate(parsed, result) {
  const artistNorm = normalize(parsed.artist ?? '')
  const resultName = normalize(result.artistName ?? '')

  if (!artistNorm) return { passed: false, reason: 'missing artist name' }
  if (resultName !== artistNorm && !resultName.includes(artistNorm) && !artistNorm.includes(resultName)) {
    return { passed: false, reason: 'artist name does not strongly match' }
  }

  return { passed: true, reason: 'artist hard gate passed' }
}

function releaseYear(date) {
  if (!date) return null
  const year = new Date(date).getFullYear()
  return Number.isNaN(year) ? null : String(year)
}

async function itunesFetch(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`iTunes request failed: ${res.status}`)
  }
  return res.json()
}

export async function searchSongs(term) {
  const url = `${SEARCH_URL}?${new URLSearchParams({
    term,
    entity: 'song',
    limit: '25',
  })}`
  const data = await itunesFetch(url)
  return data.results ?? []
}

export async function searchAlbums(term) {
  const url = `${SEARCH_URL}?${new URLSearchParams({
    term,
    entity: 'album',
    limit: '25',
  })}`
  const data = await itunesFetch(url)
  return data.results ?? []
}

export async function searchArtists(term) {
  const url = `${SEARCH_URL}?${new URLSearchParams({
    term,
    entity: 'musicArtist',
    limit: '10',
  })}`
  const data = await itunesFetch(url)
  return data.results ?? []
}

export async function searchAlbumsWithTerms(terms) {
  const merged = new Map()

  for (const term of terms) {
    const results = await searchAlbums(term)
    for (const result of results) {
      if (result.collectionId && !merged.has(result.collectionId)) {
        merged.set(result.collectionId, result)
      }
    }
  }

  return [...merged.values()]
}

export async function lookupArtistAlbumsByTitle(artistName, albumTitle, parsed) {
  const artists = await searchArtists(artistName)
  if (artists.length === 0) return []

  const artistRanked = rankCandidates(artists, scoreArtistDetailed, parsed)
  const bestArtist = pickBestRanked(artistRanked)
  if (!bestArtist) return []

  const albums = await lookupArtistAlbums(bestArtist.result.artistId)
  const { baseTitle } = extractBaseTitle(albumTitle)

  return albums.filter((album) => {
    const phraseMatch = phraseTokensMatch(baseTitle, album.collectionName ?? '')
    return phraseMatch.matched
  })
}

export async function lookupAlbumTracks(collectionId) {
  const url = `${LOOKUP_URL}?${new URLSearchParams({
    id: String(collectionId),
    entity: 'song',
  })}`
  const data = await itunesFetch(url)

  return (data.results ?? [])
    .filter((item) => item.wrapperType === 'track' && item.kind === 'song')
    .sort((a, b) => {
      const discA = a.discNumber ?? 1
      const discB = b.discNumber ?? 1
      if (discA !== discB) return discA - discB
      return (a.trackNumber ?? 0) - (b.trackNumber ?? 0)
    })
}

export async function lookupArtistAlbums(artistId) {
  const url = `${LOOKUP_URL}?${new URLSearchParams({
    id: String(artistId),
    entity: 'album',
    limit: '200',
  })}`
  const data = await itunesFetch(url)
  return (data.results ?? []).filter((item) => item.wrapperType === 'collection')
}

export function buildParsed({ song, artist, album }) {
  const expandedAlbum = album ? expandCastAbbreviations(album) : null
  const baseTitle = album ? extractBaseTitle(album).baseTitle : null
  const searchParts = []
  if (song) searchParts.push(song)
  if (expandedAlbum) searchParts.push(expandedAlbum)
  if (artist) searchParts.push(artist)

  const isCastRecordingQuery = album ? queryRequestsCastRecording(album) : false
  const isSoundtrackQuery = album ? queryRequestsSoundtrack(album) : false
  const isCollection = Boolean(album && !artist && queryIsCollectionStyle(expandedAlbum ?? album))

  return {
    raw: searchParts.join(' '),
    song: song ?? null,
    artist: artist ?? null,
    album: album ?? null,
    expandedAlbum,
    baseTitle,
    title: song ?? expandedAlbum ?? null,
    searchTerm: searchParts.join(' '),
    isCastRecordingQuery,
    isSoundtrackQuery,
    isCollectionQuery: isCollection || Boolean(expandedAlbum && COLLECTION_KEYWORDS.test(expandedAlbum)),
    isCollectionOnly: isCollection,
  }
}

export function scoreSongDetailed(result, parsed) {
  const reasons = []
  const queryNorm = normalize(parsed.raw)
  const gate = passesSongHardGate(parsed, result)
  let score = 0

  if (!gate.passed) {
    reasons.push(`hard gate failed: ${gate.reason}`)
    return {
      score: 0,
      confidence: 0,
      hardGatePassed: false,
      rejected: true,
      rejectionReason: gate.reason,
      reasons,
    }
  }

  reasons.push(gate.reason)
  score += 0.55

  if (result.kind === 'song') {
    score += 0.1
    reasons.push('bonus: iTunes kind is song')
  }

  const trackNorm = normalize(result.trackName ?? '')
  const songNorm = normalize(parsed.song ?? '')
  if (trackNorm === songNorm) {
    score += 0.2
    reasons.push('bonus: exact song title match')
  } else if (trackNorm.includes(songNorm)) {
    score += 0.1
    reasons.push('bonus: track title contains requested song')
  }

  const penalty = badEditionPenalty(`${result.trackName ?? ''} ${result.collectionName ?? ''}`, queryNorm, reasons)
  score -= penalty

  score = Math.max(0, Math.min(1, score))
  const rejected = score < MIN_CONFIDENCE

  if (rejected) {
    reasons.push(`rejected: confidence ${score.toFixed(2)} below ${MIN_CONFIDENCE}`)
  }

  return {
    score,
    confidence: score,
    hardGatePassed: true,
    rejected,
    rejectionReason: rejected ? `confidence ${score.toFixed(2)} below threshold` : null,
    reasons,
  }
}

export function scoreAlbumDetailed(result, parsed) {
  const reasons = []
  const queryNorm = normalize(parsed.raw)
  const gate = passesAlbumHardGate(parsed, result)
  let score = 0

  if (!gate.passed) {
    const rejectionReason = gate.reason.startsWith('rejected:') || gate.reason.startsWith('query requested')
      ? gate.reason.startsWith('rejected:')
        ? gate.reason
        : `rejected: ${gate.reason}`
      : gate.reason
    reasons.push(rejectionReason.startsWith('rejected:') ? rejectionReason : `hard gate failed: ${gate.reason}`)
    return {
      score: 0,
      confidence: 0,
      hardGatePassed: false,
      rejected: true,
      rejectionReason,
      reasons,
    }
  }

  reasons.push(gate.reason)
  score += 0.55

  const collectionNorm = normalize(result.collectionName ?? '')
  const { baseTitle } = extractBaseTitle(parsed.album)
  const phraseMatch = phraseTokensMatch(baseTitle, result.collectionName ?? '')

  if (phraseMatch.matched) {
    score += 0.12
    reasons.push(`bonus: collection name matches phrase tokens (${phraseTokens(baseTitle).join(' ')})`)
  }

  const baseTitleNorm = normalize(parsed.baseTitle ?? parsed.album ?? '')

  if (baseTitleNorm && collectionNorm === baseTitleNorm) {
    score += 0.12
    reasons.push('bonus: exact album title match')
  } else if (baseTitleNorm && collectionNorm.startsWith(`${baseTitleNorm} `)) {
    if (!queryNorm.includes('bonus') && collectionNorm.includes('bonus')) {
      score -= 0.1
      reasons.push('penalty: bonus edition when not requested')
    }
    if (!queryNorm.includes('moonlight') && collectionNorm.includes('moonlight')) {
      score -= 0.08
      reasons.push('penalty: alternate edition when not requested')
    }
    if (!queryNorm.includes('deluxe') && collectionNorm.includes('deluxe')) {
      score -= 0.08
      reasons.push('penalty: deluxe edition when not requested')
    }
  }

  if (parsed.isCastRecordingQuery) {
    if (hasOfficialCastWording(collectionNorm)) {
      score += 0.18
      reasons.push('bonus: official cast recording wording')
    } else if (collectionIsCastRecording(collectionNorm)) {
      score += 0.05
      reasons.push('bonus: cast recording collection name')
    }
  } else if (parsed.isSoundtrackQuery || parsed.isCollectionQuery || /soundtrack|ost|awesome mix/.test(queryNorm)) {
    if (hasOfficialSoundtrackWording(collectionNorm)) {
      score += 0.18
      reasons.push('bonus: official soundtrack wording')
    } else if (/soundtrack|ost|score|awesome mix/.test(collectionNorm)) {
      score += 0.03
      reasons.push('bonus: generic soundtrack mention')
    }
  }

  if (result.collectionType === 'Album') {
    score += 0.08
    reasons.push('bonus: collectionType is Album')
  }

  const trackCount = result.trackCount ?? 0
  score += albumTrackCountBonus(trackCount, reasons)
  score -= albumTrackCountPenalty(trackCount, parsed, reasons)

  const collectionName = result.collectionName ?? ''
  if (isSingleOrEpRelease(collectionName, queryNorm)) {
    score -= 0.45
    reasons.push('penalty: single/EP release when full album expected')
  }

  score -= numberMismatchPenalty(parsed, result, reasons)

  const penalty = badEditionPenalty(`${result.collectionName ?? ''}`, queryNorm, reasons)
  score -= penalty

  score = Math.max(0, Math.min(1, score))
  const rejected = score < MIN_CONFIDENCE

  if (rejected) {
    reasons.push(`rejected: confidence ${score.toFixed(2)} below ${MIN_CONFIDENCE}`)
  }

  return {
    score,
    confidence: score,
    hardGatePassed: true,
    rejected,
    rejectionReason: rejected ? `confidence ${score.toFixed(2)} below threshold` : null,
    reasons,
  }
}

export function scoreArtistDetailed(result, parsed) {
  const reasons = []
  const gate = passesArtistHardGate(parsed, result)
  let score = 0

  if (!gate.passed) {
    reasons.push(`hard gate failed: ${gate.reason}`)
    return {
      score: 0,
      confidence: 0,
      hardGatePassed: false,
      rejected: true,
      rejectionReason: gate.reason,
      reasons,
    }
  }

  reasons.push(gate.reason)
  const artistNorm = normalize(parsed.artist ?? '')
  const resultName = normalize(result.artistName ?? '')

  if (resultName === artistNorm) {
    score = 0.95
    reasons.push('bonus: exact artist name match')
  } else {
    score = 0.75
    reasons.push('bonus: close artist name match')
  }

  const rejected = score < MIN_CONFIDENCE
  if (rejected) {
    reasons.push(`rejected: confidence ${score.toFixed(2)} below ${MIN_CONFIDENCE}`)
  }

  return {
    score,
    confidence: score,
    hardGatePassed: true,
    rejected,
    rejectionReason: rejected ? `confidence ${score.toFixed(2)} below threshold` : null,
    reasons,
  }
}

export function rankCandidates(results, scorer, parsed) {
  const ranked = results
    .map((result) => {
      const evaluation = scorer(result, parsed)
      return {
        result,
        ...evaluation,
      }
    })
    .sort((a, b) => b.score - a.score)

  const hasOfficialPreferred = ranked.some((item) => {
    if (item.rejected) return false
    const collectionNorm = normalize(item.result.collectionName ?? '')
    if (parsed.isCastRecordingQuery) {
      return hasOfficialCastWording(collectionNorm) && !isVariousArtists(item.result.artistName)
    }
    if (parsed.isSoundtrackQuery || parsed.isCollectionQuery) {
      return hasOfficialSoundtrackWording(collectionNorm) && !isVariousArtists(item.result.artistName)
    }
    return false
  })

  if (hasOfficialPreferred) {
    for (const item of ranked) {
      if (item.rejected || !isVariousArtists(item.result.artistName)) continue
      item.score -= 0.06
      item.confidence = item.score
      item.reasons.push('penalty: Various Artists when official collection is available')
      if (item.score < MIN_CONFIDENCE) {
        item.rejected = true
        item.rejectionReason = `rejected: confidence ${item.score.toFixed(2)} below threshold`
        item.reasons.push(item.rejectionReason)
      }
    }
    ranked.sort((a, b) => b.score - a.score)
  }

  return ranked
}

export function pickBestRanked(ranked) {
  const best = ranked.find((item) => !item.rejected && item.hardGatePassed && item.score >= MIN_CONFIDENCE)
  return best ?? null
}

function formatDuration(trackTimeMillis) {
  if (trackTimeMillis == null || trackTimeMillis <= 0) return {}
  return {
    durationMs: trackTimeMillis,
    durationSeconds: Math.round(trackTimeMillis / 1000),
  }
}

function mapTracksForOutput(tracks) {
  return tracks.map((track, index) => ({
    globalTrackNumber: index + 1,
    discNumber: track.discNumber ?? 1,
    trackNumber: track.trackNumber ?? index + 1,
    artist: track.artistName,
    title: track.trackName,
    album: track.collectionName,
    ...formatDuration(track.trackTimeMillis),
  }))
}

export function toSongOutput(query, track, confidence) {
  return {
    query,
    intent: 'song',
    result: {
      artist: track.artistName,
      title: track.trackName,
      album: track.collectionName,
      releaseYear: releaseYear(track.releaseDate),
      trackNumber: track.trackNumber ?? 1,
      source: SOURCE,
      confidence: Math.round(confidence * 100) / 100,
      ...formatDuration(track.trackTimeMillis),
    },
  }
}

export function toAlbumOutput(query, album, tracks, confidence) {
  return {
    query,
    intent: 'album',
    result: {
      artist: album.artistName,
      album: album.collectionName,
      releaseYear: releaseYear(album.releaseDate),
      trackCount: tracks.length,
      source: SOURCE,
      confidence: Math.round(confidence * 100) / 100,
      tracks: mapTracksForOutput(tracks),
    },
  }
}

export function toArtistOutput(query, artist, songs, confidence) {
  return {
    query,
    intent: 'artist',
    result: {
      artist: artist.artistName,
      songCount: songs.length,
      source: SOURCE,
      confidence: Math.round(confidence * 100) / 100,
      songs: songs.map((track) => ({
        title: track.trackName,
        album: track.collectionName,
        releaseYear: releaseYear(track.releaseDate),
        trackNumber: track.trackNumber ?? null,
        discNumber: track.discNumber ?? 1,
      })),
    },
  }
}

export function unknownOutput(query, message) {
  return {
    query,
    intent: 'unknown',
    error: message ?? 'No confident match found. Try a more specific song, album, or artist name.',
  }
}

export function formatDebugCandidate(item) {
  return {
    collectionName: item.result.collectionName ?? item.result.trackName ?? item.result.artistName,
    artistName: item.result.artistName ?? null,
    score: Math.round(item.score * 100) / 100,
    reasons: item.reasons,
    rejected: item.rejected,
    rejectionReason: item.rejectionReason,
  }
}
