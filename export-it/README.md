# Export-It

Personal CSVMusic-style app: Spotify login or CSV import → YouTube Music match → tagged MP3/M4A downloads.

Built on [CSVMusic](https://github.com/angall1/CSVMusic)'s Python core (`ytmusic_match`, `downloader`, `pipeline`) with a React web UI and FastAPI backend.

## Prerequisites

- Node.js 18+
- Python 3.10+
- [ffmpeg](https://ffmpeg.org/) on your PATH (`brew install ffmpeg`)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) on your PATH (`brew install yt-dlp`)
- Spotify Developer app ([dashboard](https://developer.spotify.com/dashboard))

## Setup

```bash
cd export-it
cp .env.example .env
# Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env

npm install
npm run backend:install
```

## Run

```bash
npm run site
```

- API: http://127.0.0.1:3001
- UI: http://127.0.0.1:5173 (use this URL — Spotify rejects `localhost` redirect URIs)

## Spotify connect troubleshooting

**403 on `/me`:** New Spotify apps are in **Development Mode**. API calls fail unless:

1. **User Management** — [Developer Dashboard](https://developer.spotify.com/dashboard) → your app → **Settings** → **User Management** → **Add user**. Use the **exact** display name and email from Spotify (Profile → Edit profile).
2. **Premium** — The **app owner** must have **Spotify Premium** for dev-mode apps to work ([Spotify docs](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)).
3. **Redirect URI** — Dashboard and `.env` must use `http://127.0.0.1:3001/api/spotify/callback` (not `localhost`).
4. After fixing settings, click **Disconnect** in the app (or delete `export-it/data/export-it.db`) and connect again.


1. **Connect Spotify** in the app.
2. Paste a **Spotify album or playlist URL** and click **Load**, *or* drop a **TuneMyMusic CSV**.
3. Set an **output folder** (defaults to `export-it/Music`).
4. Click **Start**. Yellow rows = low-confidence matches — use **Alternatives** after the job starts.

## Project layout

| Path | Purpose |
|------|---------|
| `backend/csvmusic/core/` | Vendored CSVMusic engine + `pipeline.py`, `spotify_import.py` |
| `backend/api/` | FastAPI routes (Spotify OAuth, jobs, CSV import) |
| `src/` | React UI |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run site` | Start API + frontend |
| `npm run backend:install` | Create Python venv and install backend |
| `npm run build` | Build frontend for production |
