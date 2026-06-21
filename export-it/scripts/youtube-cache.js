import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalize } from './itunes.js'

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'youtube-search')

function cacheFilePath(query, limit) {
  const key = createHash('sha256').update(`${limit}:${normalize(query)}`).digest('hex')
  return join(CACHE_DIR, `${key}.json`)
}

export async function getCachedSearch(query, limit) {
  try {
    const raw = await readFile(cacheFilePath(query, limit), 'utf8')
    const data = JSON.parse(raw)
    return data.candidates ?? null
  } catch {
    return null
  }
}

export async function setCachedSearch(query, limit, candidates) {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(
    cacheFilePath(query, limit),
    JSON.stringify(
      {
        query,
        limit,
        candidates,
        cachedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
}
