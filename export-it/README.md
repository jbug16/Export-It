# Export It

Find YouTube links for songs, albums, soundtracks, and artists using natural language. This app **does not download anything** — it only searches and displays links.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available on your PATH

Install yt-dlp on macOS:

```bash
brew install yt-dlp
```

Verify it works:

```bash
yt-dlp --version
```

## Setup

From the repo root:

```bash
npm install --prefix export-it
```

Or from the `export-it` folder:

```bash
cd export-it
npm install
```

## Metadata resolver CLI

The resolver uses the free iTunes Search API. It returns confident matches or fails clearly — it does not guess.

```bash
cd export-it
npm run resolve -- --song "Tim McGraw" --artist "Taylor Swift"
npm run resolve -- --album "Speak Now" --artist "Taylor Swift"
npm run resolve -- --album "Hamilton"
npm run resolve -- --artist "Taylor Swift"
```

Use explicit flags only. Positional text without flags shows an error.

Add `--debug` to see search terms, top candidates, scores, and rejection reasons.

### Regression tests

**Unit tests** (fast, no network — scoring, gates, cast-recording rules):

```bash
cd export-it
npm test
```

**Integration tests** (live iTunes API — same cases as below; optional cases skip if iTunes has no match):

```bash
cd export-it
npm run test:integration
```

These manual CLI checks match the integration suite. They should pass:

```bash
npm run resolve -- --song "Tim McGraw" --artist "Taylor Swift"
npm run resolve -- --song "bad guy" --artist "Billie Eilish"
npm run resolve -- --album "Speak Now" --artist "Taylor Swift"
npm run resolve -- --album "Hamilton"
npm run resolve -- --album "The Greatest Showman Soundtrack"
npm run resolve -- --album "Stardew Valley Soundtrack"
npm run resolve -- --album "Legally Blonde OBC Recording"
npm run resolve -- --album "Anastasia Original Broadway Cast Recording"
npm run resolve -- --album "Heathers The Musical World Premiere Cast Recording"
```

These should fail cleanly (do not fall back to Riverdale, Glee, or other TV/cover recordings):

```bash
npm run resolve -- --song "fake song title" --artist "Taylor Swift"
npm run resolve -- --album "random fake album name 12345"
npm run resolve -- --artist "asdfasdfasdf"
npm run resolve -- --album "Heathers Original Off-Broadway Cast Recording"
```

Use `--debug` on cast-recording queries to inspect rejection reasons. Riverdale TV soundtracks should show:
`rejected: query requested cast recording, but candidate is television soundtrack`

Note: `Heathers The Musical World Premiere Cast Recording` passes only if iTunes has that album. If not available, the resolver returns `No confident match found` instead of guessing.

## Run the app

From the repo root (recommended):

```bash
npm run site
```

This stops anything on ports 3001 and 5173, then starts the Express backend and Vite frontend in one terminal. If either process exits, the other is stopped too.

- Backend: `http://localhost:3001`
- Frontend: open the URL Vite prints (usually `http://localhost:5173`)

You can also run backend and frontend separately in two terminals from the `export-it` folder:

```bash
npm run server   # Terminal 1 — backend at http://localhost:3001
npm run dev      # Terminal 2 — frontend
```

## Usage

Type a natural-language query and click **Find Links**. Examples:

- `tim mcgraw by taylor swift` — single song
- `taylor swift's speak now album` — album with track list
- `stardew valley soundtrack` — soundtrack
- `give me all pink's songs` — best matches, capped at 30 tracks

Results show artist, song title, the YouTube video found, a link, and a confidence score.

## How it works

1. The frontend sends your query to `POST /api/search`.
2. A rule-based parser detects whether you want a song, album, soundtrack, or artist.
3. For albums, soundtracks, and artists, track lists come from the free [MusicBrainz](https://musicbrainz.org/) API (no key required).
4. For each track, the backend runs `yt-dlp` to search YouTube and ranks results by title/channel signals (official audio, VEVO, Topic channels, etc.).
5. YouTube URLs are normalized to `https://www.youtube.com/watch?v=VIDEO_ID`.

## Scripts

| Command          | Description                                      |
| ---------------- | ------------------------------------------------ |
| `npm run site`   | Run the full app (backend + frontend, one terminal) |
| `npm run stop`   | Free ports 3001 and 5173                         |
| `npm run dev`    | Start the React frontend only                    |
| `npm run server` | Start the Express backend only                   |
| `npm run resolve` | iTunes metadata resolver CLI |
| `npm test`        | Run unit tests (Vitest)      |
| `npm run test:integration` | Live iTunes regression tests |

## Notes

- Artist searches return **best matches from recent releases**, not a complete discography.
- Album and soundtrack searches depend on MusicBrainz having the release in its database.
- No YouTube API key, no paid APIs, no browser automation, no downloads.
