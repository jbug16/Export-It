import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { config } from '../config.js'

mkdirSync(config.paths.data, { recursive: true })

const db = new Database(config.paths.db)

db.exec(`
  CREATE TABLE IF NOT EXISTS playlist_matches (
    youtube_playlist_id TEXT PRIMARY KEY,
    youtube_url TEXT NOT NULL,
    spotify_album_id TEXT NOT NULL,
    spotify_album_name TEXT NOT NULL,
    spotify_artist TEXT,
    confidence REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

/**
 * @param {string} playlistId
 */
export function getCachedMatch(playlistId) {
  return db.prepare('SELECT * FROM playlist_matches WHERE youtube_playlist_id = ?').get(playlistId)
}

/**
 * @param {object} row
 */
export function saveMatch(row) {
  db.prepare(`
    INSERT INTO playlist_matches (youtube_playlist_id, youtube_url, spotify_album_id, spotify_album_name, spotify_artist, confidence)
    VALUES (@youtube_playlist_id, @youtube_url, @spotify_album_id, @spotify_album_name, @spotify_artist, @confidence)
    ON CONFLICT(youtube_playlist_id) DO UPDATE SET
      spotify_album_id = excluded.spotify_album_id,
      spotify_album_name = excluded.spotify_album_name,
      spotify_artist = excluded.spotify_artist,
      confidence = excluded.confidence,
      youtube_url = excluded.youtube_url
  `).run(row)
}

export default db
