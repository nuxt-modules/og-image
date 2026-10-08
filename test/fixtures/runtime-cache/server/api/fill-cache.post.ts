import { defineEventHandler } from 'nuxt/server'
import { useRuntimeConfig, useStorage } from '#nuxtseo/nitro'

export default defineEventHandler(async () => {
  const base = useRuntimeConfig()['nuxt-og-image'].baseCacheKey
  if (!base)
    return { retainedBytes: 0, unrelatedValue: null }
  const unrelatedStorage = useStorage('cache:unrelated')
  await unrelatedStorage.setItem('sentinel', 'keep')
  const storage = useStorage(base)
  const value = 'x'.repeat(80 * 1024)
  for (let i = 0; i < 1100; i++)
    await storage.setItem(`pressure:${i}`, value)
  const keys = await storage.getKeys()
  let retainedBytes = 0
  for (const key of keys) {
    const entry = await storage.getItem(key)
    retainedBytes += Buffer.byteLength(typeof entry === 'string' ? entry : JSON.stringify(entry))
  }
  return { retainedBytes, unrelatedValue: await unrelatedStorage.getItem('sentinel') }
})
