import { describe, expect, it } from 'vitest'
import {
  MIN_CONFIDENCE,
  buildAlbumSearchTerms,
  buildParsed,
  checkCastRecordingRequirements,
  checkUnwantedEditionRequirements,
  expandCastAbbreviations,
  normalize,
  passesAlbumHardGate,
  passesSongHardGate,
  phraseTokensMatch,
  pickBestRanked,
  queryRequestsCastRecording,
  queryRequestsSoundtrack,
  rankCandidates,
  scoreAlbumDetailed,
  scoreSongDetailed,
} from '../scripts/itunes.js'

function mockAlbum(overrides = {}) {
  return {
    collectionName: 'Hamilton: An American Musical (Original Broadway Cast Recording)',
    artistName: 'Original Broadway Cast of Hamilton',
    collectionType: 'Album',
    trackCount: 46,
    collectionId: 1,
    ...overrides,
  }
}

function mockSong(overrides = {}) {
  return {
    trackName: 'Tim McGraw',
    artistName: 'Taylor Swift',
    collectionName: 'Taylor Swift',
    kind: 'song',
    ...overrides,
  }
}

describe('normalize', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalize('The Greatest Showman: Soundtrack!')).toBe('the greatest showman soundtrack')
  })

  it('handles empty input', () => {
    expect(normalize(null)).toBe('')
    expect(normalize('')).toBe('')
  })
})

describe('expandCastAbbreviations', () => {
  it('expands OBC recording shorthand', () => {
    expect(expandCastAbbreviations('Legally Blonde OBC Recording')).toBe(
      'Legally Blonde Original Broadway Cast Recording',
    )
  })

  it('expands OOBCR shorthand', () => {
    expect(expandCastAbbreviations('Heathers OOBCR')).toBe(
      'Heathers Original Off-Broadway Cast Recording',
    )
  })
})

describe('queryRequestsCastRecording', () => {
  it('detects cast recording queries', () => {
    expect(queryRequestsCastRecording('Heathers Original Broadway Cast Recording')).toBe(true)
    expect(queryRequestsCastRecording('Legally Blonde OBC Recording')).toBe(true)
  })

  it('does not treat plain soundtracks as cast queries', () => {
    expect(queryRequestsCastRecording('Stardew Valley Soundtrack')).toBe(false)
  })
})

describe('queryRequestsSoundtrack', () => {
  it('detects soundtrack queries', () => {
    expect(queryRequestsSoundtrack('Stardew Valley Soundtrack')).toBe(true)
  })

  it('prefers cast recording over soundtrack when both could apply', () => {
    expect(queryRequestsSoundtrack('Hamilton Original Broadway Cast Recording')).toBe(false)
  })
})

describe('buildAlbumSearchTerms', () => {
  it('returns a single term for non-cast albums', () => {
    expect(buildAlbumSearchTerms('Speak Now')).toEqual(['Speak Now'])
  })

  it('generates multiple search variants for cast recording queries', () => {
    const terms = buildAlbumSearchTerms('Heathers The Musical World Premiere Cast Recording')
    expect(terms).toContain('Heathers The Musical World Premiere Cast Recording')
    expect(terms.some((term) => term.includes('World Premiere Cast Recording'))).toBe(true)
    expect(terms.length).toBeGreaterThan(3)
  })
})

describe('checkCastRecordingRequirements', () => {
  it('rejects Riverdale TV soundtrack for cast recording queries', () => {
    const parsed = buildParsed({ album: 'Heathers Original Broadway Cast Recording' })
    const result = mockAlbum({
      collectionName: 'Riverdale: Season 3 - Original Television Soundtrack',
      artistName: 'Various Artists',
    })

    const check = checkCastRecordingRequirements(parsed, result)
    expect(check.passed).toBe(false)
    expect(check.reason).toContain('television soundtrack')
  })

  it('passes a genuine cast recording candidate', () => {
    const parsed = buildParsed({ album: 'Hamilton Original Broadway Cast Recording' })
    const result = mockAlbum()

    const check = checkCastRecordingRequirements(parsed, result)
    expect(check.passed).toBe(true)
  })

  it('is a no-op for non-cast queries', () => {
    const parsed = buildParsed({ album: 'Stardew Valley Soundtrack' })
    const result = mockAlbum({
      collectionName: 'Riverdale: Season 1 - Original Television Soundtrack',
      artistName: 'Various Artists',
    })

    expect(checkCastRecordingRequirements(parsed, result).passed).toBe(true)
  })
})

describe('checkUnwantedEditionRequirements', () => {
  it('rejects piano editions when the query did not ask for piano', () => {
    const parsed = buildParsed({ album: 'Stardew Valley Soundtrack' })
    const result = mockAlbum({
      collectionName: 'Stardew Valley Soundtrack for Solo Piano',
      artistName: 'Various Artists',
    })

    const check = checkUnwantedEditionRequirements(parsed, result)
    expect(check.passed).toBe(false)
    expect(check.reason).toContain('piano')
  })

  it('allows piano when the query explicitly asks for piano', () => {
    const parsed = buildParsed({ album: 'Stardew Valley Soundtrack Piano' })
    const result = mockAlbum({
      collectionName: 'Stardew Valley Soundtrack (Piano)',
      artistName: 'Various Artists',
    })

    expect(checkUnwantedEditionRequirements(parsed, result).passed).toBe(true)
  })
})

describe('phraseTokensMatch', () => {
  it('matches tokens in order', () => {
    expect(phraseTokensMatch('stardew valley', 'Stardew Valley Official Soundtrack').matched).toBe(true)
  })

  it('reports missing tokens', () => {
    const match = phraseTokensMatch('legally blonde', 'Riverdale: Season 1 Soundtrack')
    expect(match.matched).toBe(false)
    expect(match.missing).toContain('legally')
    expect(match.missing).toContain('blonde')
  })
})

describe('passesAlbumHardGate', () => {
  it('passes when title tokens and cast requirements match', () => {
    const parsed = buildParsed({ album: 'Hamilton Original Broadway Cast Recording' })
    expect(passesAlbumHardGate(parsed, mockAlbum()).passed).toBe(true)
  })

  it('fails when required album tokens are missing', () => {
    const parsed = buildParsed({ album: 'Legally Blonde Original Broadway Cast Recording' })
    const result = mockAlbum({
      collectionName: 'Riverdale: Season 1 - Original Television Soundtrack',
      artistName: 'Various Artists',
    })

    expect(passesAlbumHardGate(parsed, result).passed).toBe(false)
  })
})

describe('passesSongHardGate', () => {
  it('passes for a strong song and artist match', () => {
    const parsed = buildParsed({ song: 'Tim McGraw', artist: 'Taylor Swift' })
    expect(passesSongHardGate(parsed, mockSong()).passed).toBe(true)
  })

  it('fails when the artist does not match', () => {
    const parsed = buildParsed({ song: 'Tim McGraw', artist: 'Taylor Swift' })
    const result = mockSong({ artistName: 'Billie Eilish' })

    expect(passesSongHardGate(parsed, result).passed).toBe(false)
  })
})

describe('scoreAlbumDetailed', () => {
  it('scores official cast recordings above the confidence threshold', () => {
    const parsed = buildParsed({ album: 'Hamilton Original Broadway Cast Recording' })
    const scored = scoreAlbumDetailed(mockAlbum(), parsed)

    expect(scored.hardGatePassed).toBe(true)
    expect(scored.rejected).toBe(false)
    expect(scored.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE)
  })

  it('rejects candidates that fail hard gates', () => {
    const parsed = buildParsed({ album: 'Heathers Original Broadway Cast Recording' })
    const scored = scoreAlbumDetailed(
      mockAlbum({
        collectionName: 'Riverdale: Season 3 - Original Television Soundtrack',
        artistName: 'Various Artists',
      }),
      parsed,
    )

    expect(scored.hardGatePassed).toBe(false)
    expect(scored.rejected).toBe(true)
    expect(scored.confidence).toBe(0)
  })
})

describe('scoreSongDetailed', () => {
  it('scores a confident song match', () => {
    const parsed = buildParsed({ song: 'Tim McGraw', artist: 'Taylor Swift' })
    const scored = scoreSongDetailed(mockSong(), parsed)

    expect(scored.hardGatePassed).toBe(true)
    expect(scored.rejected).toBe(false)
    expect(scored.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE)
  })

  it('rejects a mismatched song', () => {
    const parsed = buildParsed({ song: 'fake song title', artist: 'Taylor Swift' })
    const scored = scoreSongDetailed(mockSong({ trackName: 'Love Story' }), parsed)

    expect(scored.rejected).toBe(true)
  })
})

describe('rankCandidates and pickBestRanked', () => {
  it('prefers the official cast recording over a TV soundtrack', () => {
    const parsed = buildParsed({ album: 'Heathers Original Broadway Cast Recording' })
    const candidates = [
      mockAlbum({
        collectionName: 'Riverdale: Season 3 - Original Television Soundtrack',
        artistName: 'Various Artists',
        collectionId: 1,
      }),
      mockAlbum({
        collectionName: 'Heathers: The Musical (World Premiere Cast Recording)',
        artistName: 'World Premiere Cast of Heathers',
        collectionId: 2,
      }),
    ]

    const ranked = rankCandidates(candidates, scoreAlbumDetailed, parsed)
    const best = pickBestRanked(ranked)

    expect(best).not.toBeNull()
    expect(best.result.collectionName).toContain('Heathers')
    expect(best.result.collectionName).not.toContain('Riverdale')
  })

  it('returns null when every candidate is rejected', () => {
    const parsed = buildParsed({ album: 'random fake album name 12345' })
    const ranked = rankCandidates(
      [
        mockAlbum({
          collectionName: 'Hamilton: An American Musical (Original Broadway Cast Recording)',
          artistName: 'Original Broadway Cast of Hamilton',
        }),
      ],
      scoreAlbumDetailed,
      parsed,
    )

    expect(pickBestRanked(ranked)).toBeNull()
  })
})
