import { config } from '../config.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** @type {{ running: number, queue: { run: () => Promise<void> }[], maxConcurrent: number, delayMs: number }} */
const state = {
  running: 0,
  queue: [],
  maxConcurrent: config.maxConcurrentJobs,
  delayMs: config.jobDelayMs,
}

/**
 * @param {'safe' | 'fast'} [mode]
 */
export function setQueueMode(mode = 'safe') {
  state.maxConcurrent = mode === 'fast' ? config.maxConcurrentJobsFast : config.maxConcurrentJobs
}

/**
 * @param {() => Promise<void>} run
 */
export function enqueueJobTask(run) {
  state.queue.push({ run })
  void drainQueue()
}

async function drainQueue() {
  while (state.running < state.maxConcurrent && state.queue.length > 0) {
    const item = state.queue.shift()
    if (!item) break

    state.running++
    try {
      await item.run()
    } catch (err) {
      console.error('[Queue] Task failed:', err)
    } finally {
      state.running--
      if (state.queue.length > 0) {
        await sleep(state.delayMs)
      }
      void drainQueue()
    }
  }
}

export function getQueueStats() {
  return {
    running: state.running,
    pending: state.queue.length,
    maxConcurrent: state.maxConcurrent,
  }
}
