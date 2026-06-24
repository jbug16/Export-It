/**
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFolderName(name) {
  return String(name ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'Unknown Album'
}

/**
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFileName(name) {
  return String(name ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'Unknown Track'
}

/**
 * @param {number} n
 * @param {number} [width]
 * @returns {string}
 */
export function padTrackNumber(n, width = 2) {
  return String(n).padStart(width, '0')
}
