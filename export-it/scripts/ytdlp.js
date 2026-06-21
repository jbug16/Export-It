let delayChain = Promise.resolve()

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function waitBetweenSearches(delayMs) {
  const jitter = Math.floor(Math.random() * 200)
  const waitMs = delayMs + jitter

  delayChain = delayChain.then(() => sleep(waitMs))
  await delayChain
}

export function isBotSignInError(message) {
  const text = (message ?? '').toLowerCase()
  return (
    text.includes('sign in to confirm') ||
    text.includes("you're not a bot") ||
    text.includes('not a bot') ||
    text.includes('confirm you') ||
    text.includes('cookies-from-browser') ||
    text.includes('http error 429') ||
    text.includes('too many requests')
  )
}

export function parseExtraYtDlpArgs() {
  const raw = process.env.YTDLP_EXTRA_ARGS?.trim()
  if (!raw) return []

  const args = []
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g
  let match = pattern.exec(raw)
  while (match) {
    args.push(match[1] ?? match[2] ?? match[3])
    match = pattern.exec(raw)
  }
  return args
}
