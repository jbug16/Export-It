# CSVMusic vendor notice

The `backend/csvmusic/` package is vendored from [angall1/CSVMusic](https://github.com/angall1/CSVMusic).

Local additions:
- `core/pipeline.py` — UI-agnostic pipeline extracted from `ui/workers.py`
- `core/spotify_import.py` — Spotify Web API → track dicts (replaces TuneMyMusic CSV step)
