import { spawn } from 'node:child_process'
import { config } from '../config.js'

/**
 * @param {string[]} args
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string, error?: string }>}
 */
export function runCommand(bin, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timer

    if (options.timeoutMs) {
      timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs)
    }

    child.stdout.on('data', (c) => {
      stdout += c.toString()
    })
    child.stderr.on('data', (c) => {
      stderr += c.toString()
    })

    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      resolve({
        code: null,
        stdout,
        stderr,
        error: err.code === 'ENOENT' ? `${bin} is not installed` : err.message,
      })
    })

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

/**
 * @param {string[]} args
 * @param {object} [options]
 */
export function runYtDlp(args, options) {
  return runCommand(config.ytdlpBin, args, options)
}

/**
 * @returns {Promise<{ installed: boolean, version?: string, error?: string }>}
 */
export async function checkYtDlp() {
  const result = await runYtDlp(['--version'])
  if (result.code === null) {
    return { installed: false, error: result.error || 'yt-dlp is not installed' }
  }
  return { installed: true, version: (result.stdout || result.stderr).trim() }
}

/**
 * @returns {Promise<{ installed: boolean, version?: string, path?: string, error?: string }>}
 */
export async function checkFfmpeg() {
  if (!config.ffmpegBin) {
    return {
      installed: false,
      error: 'ffmpeg not found. Install with: brew install ffmpeg',
    }
  }

  const result = await runCommand(config.ffmpegBin, ['-version'])
  if (result.code === null) {
    return { installed: false, error: result.error || 'ffmpeg is not installed' }
  }
  const line = (result.stdout || result.stderr).split('\n')[0]
  return {
    installed: true,
    version: line.trim(),
    path: config.ffmpegLocation ?? config.ffmpegBin,
  }
}
