export async function mapWithConcurrency(items, concurrency, fn) {
  if (items.length === 0) return []

  const results = new Array(items.length)
  let nextIndex = 0
  const workers = Math.min(concurrency, items.length)

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}
