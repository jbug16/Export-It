import { spawn } from 'node:child_process'
import { extractBaseTitle, normalize } from './itunes.js'
import { getCachedSearch, setCachedSearch } from './youtube-cache.js'
import { isBotSignInError, parseExtraYtDlpArgs, sleep, waitBetweenSearches } from './ytdlp.js'

export const MIN_BEST_SCORE = 0.65
export const MIN_BEST_OFFICIAL_SCORE = 0.55
export const MIN_CANDIDATE_SCORE = 0.45
export const DEFAULT_SEARCH_LIMIT = 5

const CAST_RECORDING_MARKERS = [
  'original broadway cast recording',
  'original off broadway cast recording',
  'original cast recording',
  'cast recording',
  'studio cast recording',
  'world premiere cast recording',
  'musical',
]

const MOVIE_SOUNDTRACK_MARKERS = [
  'original motion picture soundtrack',
  'motion picture soundtrack',
  'soundtrack from the motion picture',
  'music from the motion picture',
  'music from the film',
  'soundtrack from the film',
  'from the motion picture',
  'inspired by the motion picture',
]

const GAME_SOUNDTRACK_MARKERS = [
  'original game soundtrack',
  'game soundtrack',
  'video game soundtrack',
  'game music',
  'game original soundtrack',
]

const GENERIC_REUPLOAD_CHANNELS = [
  'highqualitymusic',
  'broadcast zero',
  'lyrics camera action',
  'magnus r',
  'reginald',
  'unkown',
  'tune discovery',
  'national music',
  'abc music',
  'attack of song',
  'audios',
]

const BLOCKLISTED_CHANNELS = [
  'official audio',
  'audios',
  'music topic',
  'attack of song',
  'abc music',
  'official video',
  'national music',
  'syncopated beats',
]

const SUSPICIOUS_CHANNEL_WORDS = [
  'fanpage',
  'fan page',
  ' fan ',
  'evolution',
  'lyrics',
  'edits',
  'archive',
  'reupload',
  'bootleg',
  'animatic',
  'slime tutorial',
]

const GAME_EXTRA_PENALTY_TERMS = [
  { term: 'piano cover', unless: 'piano', weight: 0.55 },
  { term: 'for piano', unless: 'piano', weight: 0.5 },
  { term: 'solo piano', unless: 'piano', weight: 0.5 },
  { term: 'ambience', unless: null, weight: 0.5 },
  { term: 'rain sounds', unless: null, weight: 0.55 },
  { term: 'extended loop', unless: null, weight: 0.55 },
  { term: 'extended version', unless: null, weight: 0.45 },
  { term: 'fan remake', unless: null, weight: 0.55 },
  { term: 'fan made', unless: null, weight: 0.5 },
  { term: 'chiptune cover', unless: null, weight: 0.5 },
]

const VARIANT_TERMS = [
  { term: 'with', unless: 'with' },
  { term: 'feat', unless: 'feat' },
  { term: 'featuring', unless: 'featuring' },
  { term: 'remix', unless: 'remix' },
  { term: 'live', unless: 'live' },
  { term: 'clean', unless: 'clean' },
  { term: 'radio edit', unless: 'radio edit' },
  { term: 'acoustic', unless: 'acoustic' },
]

const TRANSLATION_LYRICS_REJECTION_TERMS = [
  { term: 'terjemahan indo', wordBoundary: false },
  { term: 'terjemahan', wordBoundary: false },
  { term: 'traduzione', wordBoundary: false },
  { term: 'traducao', wordBoundary: false },
  { term: 'traducida', wordBoundary: false },
  { term: 'lyric video', wordBoundary: false },
  { term: 'sub espanol', wordBoundary: false },
  { term: 'sub español', wordBoundary: false },
  { term: 'subtitle', wordBoundary: false },
  { term: 'subtitles', wordBoundary: false },
  { term: 'lirik', wordBoundary: false },
  { term: 'lyrics', wordBoundary: false },
  { term: 'espanol', wordBoundary: false },
  { term: 'español', wordBoundary: false },
  { term: 'translation', wordBoundary: false },
  { term: 'translated', wordBoundary: false },
  { term: 'indo', wordBoundary: true },
]

const NORMAL_PENALTY_TERMS = [
  { term: 'lyrics', unless: null, weight: 0.55 },
  { term: 'lyric video', unless: null, weight: 0.55 },
  { term: 'clean', unless: 'clean', weight: 0.5 },
  { term: 'radio edit', unless: 'radio edit', weight: 0.5 },
  { term: 'fanpage', unless: null, weight: 0.55 },
  { term: 'fan page', unless: null, weight: 0.55 },
  { term: 'bass boosted', unless: null, weight: 0.55 },
  { term: '8d audio', unless: null, weight: 0.55 },
  { term: '8d', unless: null, weight: 0.45 },
  { term: 'nightcore', unless: null, weight: 0.55 },
  { term: 'sped up', unless: null, weight: 0.55 },
  { term: 'slowed', unless: null, weight: 0.55 },
  { term: 'reverb', unless: null, weight: 0.55 },
  { term: 'español', unless: null, weight: 0.5 },
  { term: 'espanol', unless: null, weight: 0.5 },
  { term: 'traducida', unless: null, weight: 0.5 },
  { term: 'translation', unless: null, weight: 0.5 },
  { term: 'translated', unless: null, weight: 0.5 },
  { term: 'from guts world tour', unless: null, weight: 0.55 },
  { term: 'world tour', unless: null, weight: 0.5 },
  { term: 'live', unless: 'live', weight: 0.5 },
  { term: 'concert', unless: null, weight: 0.5 },
  { term: 'performance', unless: null, weight: 0.45 },
  { term: 'karaoke', unless: null, weight: 0.55 },
  { term: 'instrumental', unless: 'instrumental', weight: 0.5 },
  { term: 'cover by', unless: null, weight: 0.55 },
  { term: 'cover', unless: null, weight: 0.5 },
  { term: 'remix', unless: 'remix', weight: 0.5 },
  { term: 'mashup', unless: null, weight: 0.55 },
  { term: 'loop', unless: null, weight: 0.5 },
  { term: '1 hour', unless: null, weight: 0.55 },
  { term: 'reaction', unless: null, weight: 0.55 },
  { term: 'tutorial', unless: null, weight: 0.55 },
  { term: 'lyrics only', unless: null, weight: 0.55 },
  { term: 'playlist', unless: null, weight: 0.45 },
  { term: 'full album', unless: null, weight: 0.5 },
  { term: 'dance', unless: null, weight: 0.35 },
  { term: 'tribute', unless: null, weight: 0.5 },
  { term: 'rehearsal', unless: null, weight: 0.5 },
  { term: 'bootleg', unless: null, weight: 0.55 },
  { term: 'animatic', unless: null, weight: 0.55 },
]

const CAST_PENALTY_TERMS = NORMAL_PENALTY_TERMS.filter(
  ({ term }) =>
    !['cast', 'ensemble', 'broadway', 'musical', 'soundtrack', 'topic', 'original cast'].some((safe) =>
      term.includes(safe),
    ),
)

const CAST_TITLE_BONUSES = [
  { phrase: 'original broadway cast recording', weight: 0.2 },
  { phrase: 'original off broadway cast recording', weight: 0.2 },
  { phrase: 'original cast recording', weight: 0.18 },
  { phrase: 'world premiere cast recording', weight: 0.18 },
  { phrase: 'cast recording', weight: 0.12 },
  { phrase: 'provided to youtube by', weight: 0.22 },
]

export function isCastRecordingMode(album) {
  return detectScoringMode(album) === 'castRecording'
}

export function detectScoringMode(album) {
  const albumNorm = normalize(album ?? '')

  if (CAST_RECORDING_MARKERS.some((marker) => albumNorm.includes(normalize(marker)))) {
    return 'castRecording'
  }

  if (MOVIE_SOUNDTRACK_MARKERS.some((marker) => albumNorm.includes(normalize(marker)))) {
    return 'movieSoundtrack'
  }

  if (GAME_SOUNDTRACK_MARKERS.some((marker) => albumNorm.includes(normalize(marker)))) {
    return 'gameSoundtrack'
  }

  if (
    albumNorm.includes('soundtrack') &&
    !albumNorm.includes('motion picture') &&
    !albumNorm.includes('cast recording') &&
    !albumNorm.includes('broadway')
  ) {
    return 'gameSoundtrack'
  }

  return 'normal'
}

function extractShowName(album) {
  if (!album) return ''
  const { baseTitle } = extractBaseTitle(album)
  return normalize(baseTitle || album)
}

function isShortAlbumName(album) {
  const { baseTitle } = extractBaseTitle(album ?? '')
  const name = (baseTitle || album || '').trim()
  return name.length > 0 && name.length < 4
}

function metadataAllowsTerm(titleNorm, term) {
  return titleNorm.includes(normalize(term))
}

function metadataHasVariant(titleNorm) {
  return VARIANT_TERMS.some(({ unless }) => metadataAllowsTerm(titleNorm, unless))
}

function compactArtist(artistNorm) {
  return artistNorm.replace(/\s+/g, '')
}

function isBlocklistedChannel(channelNorm) {
  return BLOCKLISTED_CHANNELS.some(
    (name) => channelNorm === name || channelNorm.startsWith(`${name} `) || channelNorm.includes(name),
  )
}

function isOfficialArtistChannel(channelNorm, artistNorm) {
  if (!artistNorm || !channelNorm) return false

  if (channelNorm === artistNorm) return true

  if (channelNorm === `official ${artistNorm}` || channelNorm.startsWith(`official ${artistNorm} `)) {
    return true
  }

  const compact = compactArtist(artistNorm)
  const channelCompact = channelNorm.replace(/\s+/g, '')

  const topicExact = [`${artistNorm} topic`, `${artistNorm} - topic`]
  if (topicExact.includes(channelNorm)) return true

  const vevoExact = [`${artistNorm} vevo`, `${compact}vevo`]
  if (vevoExact.includes(channelNorm) || channelCompact === `${compact}vevo`) return true

  const officialSuffixes = ['music', 'official']
  for (const suffix of officialSuffixes) {
    if (channelCompact === `${compact}${suffix}`) return true
    if (channelNorm === `${artistNorm} ${suffix}`) return true
  }

  return false
}

function channelHasSuspiciousWords(channelNorm, artistNorm) {
  if (isOfficialArtistChannel(channelNorm, artistNorm)) return false

  const padded = ` ${channelNorm} `
  for (const word of SUSPICIOUS_CHANNEL_WORDS) {
    if (padded.includes(word)) return true
  }

  if (artistNorm && channelNorm.includes(artistNorm) && channelNorm !== artistNorm) {
    const suffix = channelNorm.slice(channelNorm.indexOf(artistNorm) + artistNorm.length).trim()
    if (/\bmusic\b/.test(suffix) && suffix.length <= 12 && !isOfficialArtistChannel(channelNorm, artistNorm)) {
      return true
    }
  }

  return false
}

export function classifyChannel(channel, artist, scoringMode) {
  const channelNorm = normalize(channel ?? '')
  const artistNorm = normalize(artist ?? '')

  if (!channelNorm) {
    return { isOfficialChannel: false, channelType: 'missing' }
  }

  if (scoringMode === 'castRecording') {
    if (channelNorm.includes('topic') && !isBlocklistedChannel(channelNorm)) {
      return { isOfficialChannel: true, channelType: 'topic' }
    }
    return { isOfficialChannel: false, channelType: 'cast_other' }
  }

  if (isBlocklistedChannel(channelNorm)) {
    return { isOfficialChannel: false, channelType: 'blocklisted' }
  }

  if (channelHasSuspiciousWords(channelNorm, artistNorm)) {
    return { isOfficialChannel: false, channelType: 'suspicious' }
  }

  if (isOfficialArtistChannel(channelNorm, artistNorm)) {
    if (channelNorm.includes('topic')) {
      return { isOfficialChannel: true, channelType: 'topic' }
    }
    if (channelNorm.includes('vevo') || channelNorm.endsWith('vevo')) {
      return { isOfficialChannel: true, channelType: 'vevo' }
    }
    return { isOfficialChannel: true, channelType: 'artist' }
  }

  if (artistNorm && channelNorm.includes(artistNorm) && channelNorm !== artistNorm) {
    return { isOfficialChannel: false, channelType: 'unofficial_partial' }
  }

  if (channelNorm.includes('topic') && artistNorm && !channelNorm.includes(artistNorm)) {
    return { isOfficialChannel: false, channelType: 'foreign_topic' }
  }

  return { isOfficialChannel: false, channelType: 'other' }
}

function haystackForCandidate(candidate) {
  return `${candidate.title ?? ''} ${candidate.channel ?? ''}`.toLowerCase()
}

function haystackContainsTerm(haystack, term, { wordBoundary = false } = {}) {
  const termNorm = normalize(term)
  if (!termNorm) return false
  if (!wordBoundary) return haystack.includes(termNorm)
  const escaped = termNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(haystack)
}

function allowsOfficialLyricVideoFallback(titleLower, term) {
  if (term !== 'lyrics' && term !== 'lyric video') return false
  return isOfficialLyricVideo(titleLower) || titleLower.includes('official lyric video')
}

function getTranslationLyricsRejection(candidate, channelInfo) {
  const haystack = normalize(haystackForCandidate(candidate))
  const titleLower = (candidate.title ?? '').toLowerCase()
  const { isOfficialChannel } = channelInfo

  for (const { term, wordBoundary } of TRANSLATION_LYRICS_REJECTION_TERMS) {
    if (!haystackContainsTerm(haystack, term, { wordBoundary })) continue

    if (isOfficialChannel && allowsOfficialLyricVideoFallback(titleLower, term)) {
      continue
    }

    if (isOfficialChannel) {
      return {
        rejected: true,
        reason: `translation/lyrics term "${term}" on official channel (not official lyric video)`,
      }
    }

    return {
      rejected: true,
      reason: `translation/lyrics term "${term}" on non-official channel`,
    }
  }

  return { rejected: false, reason: null }
}

function hasBlockedTranslationLyrics(item) {
  if (!item?.title) return false
  const channelInfo = { isOfficialChannel: item.isOfficialChannel ?? false }
  return getTranslationLyricsRejection(item, channelInfo).rejected
}

function extractPrimaryArtist(artist) {
  const text = (artist ?? '').trim()
  if (!text) return text
  const parts = text.split(/\s*(?:&|feat\.?|featuring|with)\s*/i)
  return parts[0]?.trim() || text
}

function artistForLookup(trackMeta, scoringMode) {
  if (scoringMode === 'normal') {
    return extractPrimaryArtist(trackMeta.artist)
  }
  return trackMeta.artist ?? ''
}

function titleWordCoverage(titleNorm, candidateTitleNorm) {
  const titleWords = titleNorm.split(' ').filter(Boolean)
  if (titleWords.length === 0) return 0
  const matched = titleWords.filter((word) => candidateTitleNorm.includes(word))
  return matched.length / titleWords.length
}

function durationDiff(expectedDuration, candidateDuration) {
  if (expectedDuration == null || candidateDuration == null) return null
  return Math.abs(candidateDuration - expectedDuration)
}

function isDurationClose(item, trackMeta, maxDiff = 10) {
  const diff = durationDiff(trackMeta.durationSeconds, item.duration)
  return diff != null && diff <= maxDiff
}

function isOfficialLyricVideo(titleLower) {
  return titleLower.includes('official lyric video') || titleLower.includes('official lyrics video')
}

function isOfficialMusicVideo(titleLower) {
  return (
    titleLower.includes('official video') ||
    titleLower.includes('official music video') ||
    titleLower.includes('visualizer')
  )
}

function isLongFormOfficialRelease(titleLower, isOfficialChannel) {
  if (!isOfficialChannel) return false
  return isOfficialMusicVideo(titleLower) || isOfficialLyricVideo(titleLower)
}

function applyNormalDurationScoring(score, reasons, trackMeta, candidate, isOfficialChannel) {
  const expectedDuration = trackMeta.durationSeconds
  const candidateDuration = candidate.duration
  const titleLower = (candidate.title ?? '').toLowerCase()

  if (expectedDuration == null || candidateDuration == null) {
    if (expectedDuration != null) {
      reasons.push('neutral: candidate duration missing, no duration bonus')
    }
    return score
  }

  const diff = Math.abs(candidateDuration - expectedDuration)
  const longOfficial = isLongFormOfficialRelease(titleLower, isOfficialChannel)

  if (isOfficialChannel) {
    if (diff <= 10) {
      score += 0.15
      reasons.push(`bonus: duration within ${diff}s of metadata (${expectedDuration}s)`)
    } else if (diff <= 30) {
      score += 0.08
      reasons.push(`bonus: official upload duration within ${diff}s of metadata`)
    } else if (longOfficial && diff <= 45) {
      reasons.push(`neutral: official video duration off by ${diff}s (acceptable)`)
    } else if (longOfficial && diff <= 60) {
      score -= 0.08
      reasons.push(`penalty: official video duration off by ${diff}s (weak match)`)
    } else if (diff <= 30) {
      reasons.push(`neutral: official upload duration off by ${diff}s`)
    } else {
      score -= 0.35
      reasons.push(`penalty: official duration off by ${diff}s (expected ${expectedDuration}s, got ${candidateDuration}s)`)
    }
    return score
  }

  if (diff <= 10) {
    score += 0.15
    reasons.push(`bonus: duration within ${diff}s of metadata (${expectedDuration}s)`)
  } else if (diff > 30) {
    score -= 0.45
    reasons.push(`penalty: duration off by ${diff}s (expected ${expectedDuration}s, got ${candidateDuration}s)`)
  } else {
    reasons.push(`neutral: duration off by ${diff}s (within tolerance band)`)
  }

  return score
}

function applyAlbumContextBonus(score, reasons, trackMeta, candidateTitleNorm, candidateDescriptionNorm = '') {
  const albumNorm = normalize(trackMeta.album ?? '')
  if (!albumNorm) return score

  const haystack = `${candidateTitleNorm} ${candidateDescriptionNorm}`

  if (haystack.includes(albumNorm)) {
    score += 0.06
    reasons.push('bonus: candidate mentions album name')
    return score
  }

  const albumWords = albumNorm.split(' ').filter((word) => word.length > 3)
  const matched = albumWords.filter((word) => haystack.includes(word))
  if (matched.length >= Math.min(2, albumWords.length)) {
    score += 0.04
    reasons.push('bonus: candidate mentions key album words')
  }

  return score
}

function applyDurationScoring(score, reasons, trackMeta, candidateDuration, { weightClose = 0.15, weightFar = 0.45 } = {}) {
  const expectedDuration = trackMeta.durationSeconds

  if (expectedDuration == null || candidateDuration == null) {
    if (expectedDuration != null) {
      reasons.push('neutral: candidate duration missing, no duration bonus')
    }
    return score
  }

  const diff = Math.abs(candidateDuration - expectedDuration)
  if (diff <= 10) {
    score += weightClose
    reasons.push(`bonus: duration within ${diff}s of metadata (${expectedDuration}s)`)
  } else if (diff > 30) {
    score -= weightFar
    reasons.push(`penalty: duration off by ${diff}s (expected ${expectedDuration}s, got ${candidateDuration}s)`)
  } else {
    reasons.push(`neutral: duration off by ${diff}s (within tolerance band)`)
  }

  return score
}

function applyPenaltyTerms(score, reasons, haystack, metadataTitleNorm, terms, options = {}) {
  const { isOfficialChannel = false, candidateTitleLower = '' } = options

  for (const { term, unless, weight } of terms) {
    if (!haystack.includes(term)) continue
    if (unless && metadataAllowsTerm(metadataTitleNorm, unless)) continue

    if (
      (term === 'lyrics' || term === 'lyric video') &&
      isOfficialChannel &&
      isOfficialLyricVideo(candidateTitleLower)
    ) {
      continue
    }

    score -= weight
    reasons.push(`penalty: contains "${term}"`)
  }
  return score
}

function applyVariantMismatchPenalty(score, reasons, metadataTitleNorm, haystack) {
  if (metadataHasVariant(metadataTitleNorm)) return score

  for (const { term, unless } of VARIANT_TERMS) {
    if (!haystack.includes(normalize(term))) continue
    if (metadataAllowsTerm(metadataTitleNorm, unless)) continue
    score -= 0.5
    reasons.push(`penalty: variant "${term}" not in metadata title`)
  }

  return score
}

function applyOfficialChannelBonus(score, reasons, channelType) {
  if (channelType === 'artist') {
    score += 0.45
    reasons.push('bonus: official artist channel')
  } else if (channelType === 'topic') {
    score += 0.45
    reasons.push('bonus: official artist Topic channel')
  } else if (channelType === 'vevo') {
    score += 0.35
    reasons.push('bonus: official artist VEVO channel')
  }
  return score
}

function applyUnofficialChannelPenalty(score, reasons, channelType) {
  if (channelType === 'unofficial_partial') {
    score -= 0.25
    reasons.push('penalty: channel contains artist name but is not official')
  } else if (channelType === 'suspicious' || channelType === 'blocklisted') {
    score -= 0.4
    reasons.push(`penalty: unofficial channel (${channelType})`)
  } else if (channelType === 'foreign_topic') {
    score -= 0.35
    reasons.push('penalty: Topic channel is not artist-owned')
  }
  return score
}

function scoreNormalCandidate(candidate, trackMeta, context) {
  const reasons = []
  let score = 0

  const titleNorm = normalize(trackMeta.title ?? '')
  const artistNorm = normalize(trackMeta.artist ?? '')
  const lookupArtistNorm = normalize(artistForLookup(trackMeta, context.scoringMode))
  const metadataTitleNorm = normalize(trackMeta.title ?? '')
  const candidateTitleNorm = normalize(candidate.title ?? '')
  const candidateTitleLower = (candidate.title ?? '').toLowerCase()
  const haystack = haystackForCandidate(candidate)
  const { isOfficialChannel, channelType } = context.channelInfo

  if (titleNorm && candidateTitleNorm.includes(titleNorm)) {
    score += 0.2
    reasons.push('bonus: title contains song title')
  } else if (titleNorm) {
    const coverage = titleWordCoverage(titleNorm, candidateTitleNorm)
    if (coverage >= 0.75) {
      score += 0.08
      reasons.push(`bonus: title partially matches song (${Math.round(coverage * 100)}%)`)
    } else {
      score -= 0.25
      reasons.push(`penalty: title weakly matches song (${Math.round(coverage * 100)}%)`)
    }
  }

  if (isOfficialChannel) {
    score = applyOfficialChannelBonus(score, reasons, channelType)
  } else {
    score = applyUnofficialChannelPenalty(score, reasons, channelType)
  }

  if (artistNorm && candidateTitleNorm.includes(artistNorm)) {
    score += 0.05
    reasons.push('bonus: title contains artist name')
  } else if (lookupArtistNorm && candidateTitleNorm.includes(lookupArtistNorm)) {
    score += 0.05
    reasons.push('bonus: title contains primary artist name')
  }

  if (candidateTitleLower.includes('official audio')) {
    if (isOfficialChannel) {
      score += 0.08
      reasons.push('bonus: Official Audio on official channel')
    } else if (!context.hasOfficialInPool) {
      score += 0.12
      reasons.push('bonus: Official Audio (no official channel in results)')
    } else {
      score += 0.02
      reasons.push('neutral: Official Audio on unofficial channel (official exists in pool)')
    }
  }

  if (
    (candidateTitleLower.includes('official video') || candidateTitleLower.includes('official music video')) &&
    isOfficialChannel
  ) {
    score += 0.1
    reasons.push('bonus: official music video on official channel')
  }

  if (isOfficialLyricVideo(candidateTitleLower) && isOfficialChannel) {
    score += 0.1
    reasons.push('bonus: official lyric video on official channel')
  }

  if (candidateTitleLower.includes('visualizer') && isOfficialChannel) {
    score += 0.08
    reasons.push('bonus: official visualizer on official channel')
  }

  if (candidateTitleLower.includes('provided to youtube by')) {
    score += 0.18
    reasons.push('bonus: title contains Provided to YouTube by')
  }

  score = applyAlbumContextBonus(score, reasons, trackMeta, candidateTitleNorm)

  score = applyPenaltyTerms(score, reasons, haystack, metadataTitleNorm, NORMAL_PENALTY_TERMS, {
    isOfficialChannel,
    candidateTitleLower,
  })
  score = applyVariantMismatchPenalty(score, reasons, metadataTitleNorm, haystack)
  score = applyNormalDurationScoring(score, reasons, trackMeta, candidate, isOfficialChannel)

  return { score, reasons }
}

function scorePerArtistCandidate(candidate, trackMeta, context, modeLabel) {
  const reasons = [`${modeLabel} scoring mode`]
  let score = 0

  const titleNorm = normalize(trackMeta.title ?? '')
  const artistNorm = normalize(trackMeta.artist ?? '')
  const albumNorm = normalize(trackMeta.album ?? '')
  const metadataTitleNorm = normalize(trackMeta.title ?? '')
  const candidateTitleNorm = normalize(candidate.title ?? '')
  const haystack = haystackForCandidate(candidate)
  const { isOfficialChannel, channelType } = context.channelInfo

  if (titleNorm && candidateTitleNorm.includes(titleNorm)) {
    score += 0.22
    reasons.push('bonus: title contains track title')
  } else if (titleNorm) {
    const coverage = titleWordCoverage(titleNorm, candidateTitleNorm)
    if (coverage >= 0.75) {
      score += 0.1
      reasons.push(`bonus: title partially matches track (${Math.round(coverage * 100)}%)`)
    } else {
      score -= 0.22
      reasons.push(`penalty: title weakly matches track (${Math.round(coverage * 100)}%)`)
    }
  }

  if (isOfficialChannel) {
    score = applyOfficialChannelBonus(score, reasons, channelType)
  } else {
    score = applyUnofficialChannelPenalty(score, reasons, channelType)
  }

  if (artistNorm && candidateTitleNorm.includes(artistNorm)) {
    score += 0.06
    reasons.push('bonus: title contains track artist')
  }

  if (
    context.scoringMode === 'movieSoundtrack' &&
    titleNorm &&
    candidateTitleNorm.includes(titleNorm) &&
    artistNorm &&
    candidateTitleNorm.includes(artistNorm.split(' ')[0])
  ) {
    score += 0.15
    reasons.push('bonus: soundtrack title contains artist and track name')
  }

  if (albumNorm && candidateTitleNorm.includes(albumNorm)) {
    score += 0.08
    reasons.push('bonus: title contains album name')
  }

  score = applyPenaltyTerms(score, reasons, haystack, metadataTitleNorm, NORMAL_PENALTY_TERMS)
  score = applyVariantMismatchPenalty(score, reasons, metadataTitleNorm, haystack)
  score = applyDurationScoring(score, reasons, trackMeta, candidate.duration)

  return { score, reasons }
}

function scoreGameSoundtrackCandidate(candidate, trackMeta, context) {
  const { score, reasons } = scorePerArtistCandidate(candidate, trackMeta, context, 'gameSoundtrack')
  let adjusted = score

  const titleNorm = normalize(trackMeta.title ?? '')
  const albumNorm = normalize(trackMeta.album ?? '')
  const artistNorm = normalize(trackMeta.artist ?? '')
  const candidateTitleNorm = normalize(candidate.title ?? '')
  const haystack = haystackForCandidate(candidate)
  const metadataTitleNorm = normalize(trackMeta.title ?? '')
  const albumWords = extractShowName(trackMeta.album).split(' ').filter((word) => word.length > 2)

  for (const word of albumWords.slice(0, 3)) {
    if (candidateTitleNorm.includes(word)) {
      adjusted += 0.06
      reasons.push(`bonus: title contains game/album word "${word}"`)
      break
    }
  }

  if (artistNorm && normalize(candidate.channel ?? '').includes(artistNorm)) {
    adjusted += 0.08
    reasons.push('bonus: channel contains composer/artist name')
  }

  adjusted = applyPenaltyTerms(adjusted, reasons, haystack, metadataTitleNorm, GAME_EXTRA_PENALTY_TERMS)
  adjusted = applyDurationScoring(adjusted, reasons, trackMeta, candidate.duration, {
    weightClose: 0.2,
    weightFar: 0.5,
  })

  if (albumNorm && candidateTitleNorm.includes(albumNorm)) {
    adjusted += 0.1
    reasons.push('bonus: title contains full album name')
  }

  return { score: adjusted, reasons }
}

function scoreCastCandidate(candidate, trackMeta, context) {
  const reasons = ['castRecording scoring mode']
  let score = 0

  const titleNorm = normalize(trackMeta.title ?? '')
  const albumNorm = normalize(trackMeta.album ?? '')
  const metadataTitleNorm = normalize(trackMeta.title ?? '')
  const candidateTitleNorm = normalize(candidate.title ?? '')
  const candidateTitleLower = (candidate.title ?? '').toLowerCase()
  const haystack = haystackForCandidate(candidate)
  const { isOfficialChannel } = context.channelInfo

  if (titleNorm && candidateTitleNorm.includes(titleNorm)) {
    score += 0.28
    reasons.push('bonus: title contains track title')
  } else if (titleNorm) {
    const coverage = titleWordCoverage(titleNorm, candidateTitleNorm)
    if (coverage >= 0.75) {
      score += 0.12
      reasons.push(`bonus: title partially matches track (${Math.round(coverage * 100)}%)`)
    } else {
      score -= 0.2
      reasons.push(`penalty: title weakly matches track (${Math.round(coverage * 100)}%)`)
    }
  }

  if (albumNorm && candidateTitleNorm.includes(albumNorm)) {
    score += 0.15
    reasons.push('bonus: title contains album/show name')
  } else if (albumNorm) {
    const albumWords = albumNorm.split(' ').filter((word) => word.length > 3)
    const matched = albumWords.filter((word) => candidateTitleNorm.includes(word))
    if (matched.length >= Math.min(3, albumWords.length)) {
      score += 0.08
      reasons.push('bonus: title contains key album words')
    }
  }

  for (const { phrase, weight } of CAST_TITLE_BONUSES) {
    if (candidateTitleLower.includes(phrase)) {
      score += weight
      reasons.push(`bonus: title contains "${phrase}"`)
    }
  }

  if (isOfficialChannel) {
    score += 0.15
    reasons.push('bonus: Topic channel (cast recording)')
  }

  const showNorm = extractShowName(trackMeta.album)
  const channelNorm = normalize(candidate.channel ?? '')
  const primaryShow = showNorm.split(' ').filter(Boolean)[0] ?? ''

  if (primaryShow && (channelNorm === primaryShow || channelNorm === showNorm)) {
    score += 0.22
    reasons.push('bonus: channel matches show name')
  } else if (primaryShow && channelNorm.includes(primaryShow) && channelNorm.length <= primaryShow.length + 12) {
    score += 0.12
    reasons.push('bonus: channel contains show name')
  }

  if (GENERIC_REUPLOAD_CHANNELS.some((name) => channelNorm.includes(name))) {
    score -= 0.3
    reasons.push('penalty: generic reupload channel')
  }

  score = applyPenaltyTerms(score, reasons, haystack, metadataTitleNorm, CAST_PENALTY_TERMS)
  score = applyVariantMismatchPenalty(score, reasons, metadataTitleNorm, haystack)
  score = applyDurationScoring(score, reasons, trackMeta, candidate.duration)

  return { score, reasons }
}

function scoreByMode(candidate, trackMeta, context) {
  switch (context.scoringMode) {
    case 'castRecording':
      return scoreCastCandidate(candidate, trackMeta, context)
    case 'movieSoundtrack':
      return scorePerArtistCandidate(candidate, trackMeta, context, 'movieSoundtrack')
    case 'gameSoundtrack':
      return scoreGameSoundtrackCandidate(candidate, trackMeta, context)
    default:
      return scoreNormalCandidate(candidate, trackMeta, context)
  }
}

export function scoreCandidate(candidate, trackMeta, context) {
  if (!candidate.title || !candidate.url) {
    return {
      score: 0,
      confidence: 0,
      rejected: true,
      rejectionReason: 'missing title or url',
      reasons: ['rejected: missing title or url'],
      isOfficialChannel: false,
      mode: context.scoringMode,
      castRecordingMode: context.scoringMode === 'castRecording',
      movieSoundtrackMode: context.scoringMode === 'movieSoundtrack',
      gameSoundtrackMode: context.scoringMode === 'gameSoundtrack',
    }
  }

  const channelInfo = classifyChannel(
    candidate.channel,
    artistForLookup(trackMeta, context.scoringMode),
    context.scoringMode,
  )
  const scoringContext = { ...context, channelInfo }
  const { score: rawScore, reasons } = scoreByMode(candidate, trackMeta, scoringContext)

  let score = Math.max(0, Math.min(1, rawScore))
  let rejected = score < MIN_CANDIDATE_SCORE
  let rejectionReason = rejected ? `confidence ${score.toFixed(2)} below threshold` : null

  const translationReject = getTranslationLyricsRejection(candidate, channelInfo)
  if (translationReject.rejected) {
    score = 0
    rejected = true
    rejectionReason = translationReject.reason
    reasons.push(`rejected: ${translationReject.reason}`)
  } else if (rejected) {
    reasons.push(`rejected: confidence ${score.toFixed(2)} below ${MIN_CANDIDATE_SCORE}`)
  }

  return {
    score,
    confidence: Math.round(score * 100) / 100,
    rejected,
    rejectionReason,
    reasons,
    isOfficialChannel: channelInfo.isOfficialChannel,
    mode: context.scoringMode,
    castRecordingMode: context.scoringMode === 'castRecording',
    movieSoundtrackMode: context.scoringMode === 'movieSoundtrack',
    gameSoundtrackMode: context.scoringMode === 'gameSoundtrack',
  }
}

function rankCandidates(candidates, trackMeta, scoringMode) {
  const lookupArtist = artistForLookup(trackMeta, scoringMode)
  const preliminary = candidates.map((candidate) => ({
    candidate,
    channelInfo: classifyChannel(candidate.channel, lookupArtist, scoringMode),
  }))

  const hasOfficialInPool = preliminary.some(({ channelInfo }) => channelInfo.isOfficialChannel)
  const context = { scoringMode, hasOfficialInPool }

  return candidates
    .map((candidate) => {
      const evaluation = scoreCandidate(candidate, trackMeta, context)
      return { ...candidate, ...evaluation }
    })
    .sort((a, b) => b.score - a.score)
}

function titleContainsTrack(item, trackMeta) {
  const titleNorm = normalize(trackMeta.title ?? '')
  const candidateTitleNorm = normalize(item.title ?? '')
  return titleNorm && candidateTitleNorm.includes(titleNorm)
}

function officialDurationAcceptable(item, trackMeta) {
  const diff = durationDiff(trackMeta.durationSeconds, item.duration)
  if (diff == null) return true

  const titleLower = (item.title ?? '').toLowerCase()
  const longOfficial = isLongFormOfficialRelease(titleLower, item.isOfficialChannel)

  if (diff <= 30) return true
  if (longOfficial && diff <= 45) return true
  if (longOfficial && diff <= 60) return 'weak'
  return false
}

function qualifiesAsBest(item, trackMeta, scoringMode) {
  if (item.rejected || hasBlockedTranslationLyrics(item)) return false

  if (scoringMode === 'castRecording') {
    if (item.score >= MIN_BEST_SCORE) return true
    if (
      item.score >= MIN_BEST_OFFICIAL_SCORE &&
      isDurationClose(item, trackMeta, 10) &&
      titleContainsTrack(item, trackMeta)
    ) {
      return true
    }
    return false
  }

  if (scoringMode === 'movieSoundtrack' || scoringMode === 'gameSoundtrack') {
    if (item.score >= MIN_BEST_SCORE) return true
    if (
      item.score >= MIN_BEST_OFFICIAL_SCORE &&
      isDurationClose(item, trackMeta, scoringMode === 'gameSoundtrack' ? 10 : 15) &&
      titleContainsTrack(item, trackMeta)
    ) {
      return true
    }
    return false
  }

  if (item.isOfficialChannel && titleContainsTrack(item, trackMeta)) {
    if (item.score >= MIN_BEST_SCORE) return true

    const durationCheck = officialDurationAcceptable(item, trackMeta)
    if (item.score >= MIN_BEST_OFFICIAL_SCORE && durationCheck === true) {
      return true
    }
    if (item.score >= MIN_BEST_OFFICIAL_SCORE && durationCheck === 'weak') {
      return true
    }
    return false
  }

  return item.score >= MIN_BEST_SCORE
}

function isStrongBest(item, trackMeta, scoringMode) {
  if (!item || item.rejected) return false
  if (item.score >= MIN_BEST_SCORE) return true

  if (scoringMode === 'normal' && item.isOfficialChannel && titleContainsTrack(item, trackMeta)) {
    const durationCheck = officialDurationAcceptable(item, trackMeta)
    return item.score >= MIN_BEST_OFFICIAL_SCORE && durationCheck !== false
  }

  return false
}

function pickBest(ranked, trackMeta, scoringMode) {
  return ranked.find((item) => qualifiesAsBest(item, trackMeta, scoringMode)) ?? null
}

function toPublicCandidate(item, debug) {
  const base = {
    id: item.id,
    title: item.title,
    channel: item.channel,
    url: item.url,
    duration: item.duration,
    view_count: item.view_count,
    isOfficialChannel: item.isOfficialChannel ?? false,
  }

  if (debug) {
    return {
      ...base,
      score: item.confidence,
      mode: item.mode,
      castRecordingMode: item.castRecordingMode,
      movieSoundtrackMode: item.movieSoundtrackMode,
      gameSoundtrackMode: item.gameSoundtrackMode,
      reasons: item.reasons,
      rejected: item.rejected,
      rejectionReason: item.rejectionReason,
    }
  }

  return base
}

export function buildSearchQueryPlan(trackMeta, scoringMode) {
  const artist = artistForLookup(trackMeta, scoringMode)
  const title = trackMeta.title ?? ''
  const album = trackMeta.album ?? ''
  const shortAlbum = isShortAlbumName(trackMeta.albumQuery ?? album)

  if (scoringMode === 'castRecording' && album) {
    return [
      `${album} ${title}`.replace(/\s+/g, ' ').trim(),
      `${album} ${title} official audio`.replace(/\s+/g, ' ').trim(),
    ].filter(Boolean)
  }

  if (scoringMode === 'movieSoundtrack') {
    return [
      `${artist} ${title} official audio`.replace(/\s+/g, ' ').trim(),
      `${artist} ${title} ${album}`.replace(/\s+/g, ' ').trim(),
      `${title} ${album}`.replace(/\s+/g, ' ').trim(),
    ].filter(Boolean)
  }

  if (scoringMode === 'gameSoundtrack') {
    return [
      `${artist} ${title} ${album}`.replace(/\s+/g, ' ').trim(),
      `${album} ${title}`.replace(/\s+/g, ' ').trim(),
      `${title} ${artist}`.replace(/\s+/g, ' ').trim(),
    ].filter(Boolean)
  }

  const queries = [
    `${artist} ${title} official audio`.replace(/\s+/g, ' ').trim(),
    `${artist} ${title} official video`.replace(/\s+/g, ' ').trim(),
    `${artist} ${title} official lyric video`.replace(/\s+/g, ' ').trim(),
  ]
  if (album) {
    queries.push(`${artist} ${title} ${album}`.replace(/\s+/g, ' ').trim())
  }
  if (shortAlbum && album) {
    queries.push(`${title} ${artist} ${album}`.replace(/\s+/g, ' ').trim())
  }

  return [...new Set(queries.filter(Boolean))]
}

async function runYtDlpSearchOnce(searchQuery, limit = DEFAULT_SEARCH_LIMIT) {
  return new Promise((resolve, reject) => {
    const extraArgs = parseExtraYtDlpArgs()
    const args = [
      `ytsearch${limit}:${searchQuery}`,
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      ...extraArgs,
    ]

    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}`))
    })

    proc.on('close', (code) => {
      const combined = `${stderr}\n${stdout}`
      if (isBotSignInError(combined)) {
        reject(new Error(stderr.trim() || 'YouTube sign-in / bot verification required'))
        return
      }

      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
        return
      }

      resolve(stdout)
    })
  })
}

async function runYtDlpSearch(searchQuery, limit, retries) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await runYtDlpSearchOnce(searchQuery, limit)
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        await sleep(1500 * (attempt + 1))
      }
    }
  }

  throw lastError
}

function parseYtDlpJsonLines(stdout) {
  const results = []

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      results.push(JSON.parse(trimmed))
    } catch {
      // skip malformed lines
    }
  }

  return results
}

export function formatCandidate(raw) {
  return {
    id: raw.id ?? null,
    title: raw.title ?? null,
    channel: raw.channel ?? raw.uploader ?? null,
    url: raw.webpage_url ?? raw.url ?? (raw.id ? `https://www.youtube.com/watch?v=${raw.id}` : null),
    duration: raw.duration ?? null,
    view_count: raw.view_count ?? null,
  }
}

export async function searchYouTube(
  searchQuery,
  {
    limit = DEFAULT_SEARCH_LIMIT,
    useCache = true,
    onCacheHit,
    delayMs = 0,
    retries = 0,
  } = {},
) {
  if (useCache) {
    const cached = await getCachedSearch(searchQuery, limit)
    if (cached) {
      onCacheHit?.(searchQuery)
      return cached
    }
  }

  if (delayMs > 0) {
    await waitBetweenSearches(delayMs)
  }

  const stdout = await runYtDlpSearch(searchQuery, limit, retries)
  const candidates = parseYtDlpJsonLines(stdout).map(formatCandidate)

  if (useCache) {
    await setCachedSearch(searchQuery, limit, candidates)
  }

  return candidates
}

function buildYouTubeResult({ searchQuery, scoringMode, best, ranked, debug, debugInfo, error = null }) {
  const result = {
    searchQuery,
    mode: scoringMode,
    castRecordingMode: scoringMode === 'castRecording',
    movieSoundtrackMode: scoringMode === 'movieSoundtrack',
    gameSoundtrackMode: scoringMode === 'gameSoundtrack',
    best: best ? toPublicCandidate(best, false) : null,
  }

  if (error) {
    result.error = error
  }

  if (debug) {
    result.candidates = ranked.map((item) => toPublicCandidate(item, true))
    result.debug = debugInfo
  }

  return result
}

export async function findYouTubeForTrack(
  trackMeta,
  {
    debug = false,
    scoringMode: scoringModeOverride = null,
    useCache = true,
    onCacheHit,
    delayMs = 0,
    retries = 0,
  } = {},
) {
  const scoringMode = scoringModeOverride ?? detectScoringMode(trackMeta.album)
  const queries = buildSearchQueryPlan(trackMeta, scoringMode)
  let allCandidates = []
  let searchQuery = queries[0]
  const debugInfo = debug
    ? {
        mode: scoringMode,
        castRecordingMode: scoringMode === 'castRecording',
        movieSoundtrackMode: scoringMode === 'movieSoundtrack',
        gameSoundtrackMode: scoringMode === 'gameSoundtrack',
        searches: [],
      }
    : null

  try {
    for (let i = 0; i < queries.length; i += 1) {
      const query = queries[i]
      const rawCandidates = await searchYouTube(query, {
        limit: DEFAULT_SEARCH_LIMIT,
        useCache,
        onCacheHit,
        delayMs,
        retries,
      })
      const ranked = rankCandidates(rawCandidates, trackMeta, scoringMode)

      if (debug) {
        debugInfo.searches.push({
          searchQuery: query,
          rawTitles: rawCandidates.map((c) => c.title),
          candidates: ranked.map((item) => toPublicCandidate(item, true)),
        })
      }

      allCandidates = mergeCandidates(allCandidates, ranked)

      const best = pickBest(allCandidates, trackMeta, scoringMode)
      searchQuery = query

      if (isStrongBest(best, trackMeta, scoringMode)) {
        break
      }

      if (i < queries.length - 1) {
        continue
      }

      break
    }

    const ranked = [...allCandidates].sort((a, b) => b.score - a.score)
    const best = pickBest(ranked, trackMeta, scoringMode)

    return buildYouTubeResult({ searchQuery, scoringMode, best, ranked, debug, debugInfo })
  } catch (err) {
    return buildYouTubeResult({
      searchQuery,
      scoringMode,
      best: null,
      ranked: allCandidates,
      debug,
      debugInfo,
      error: err.message,
    })
  }
}

function mergeCandidates(existing, incoming) {
  const byId = new Map()

  for (const item of existing) {
    const key = item.id ?? item.url
    if (key) byId.set(key, item)
  }

  for (const item of incoming) {
    const key = item.id ?? item.url
    if (!key) continue
    const prev = byId.get(key)
    if (!prev || item.score > prev.score) {
      byId.set(key, item)
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score)
}
