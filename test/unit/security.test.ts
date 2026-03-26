import { describe, expect, it } from 'vitest'
import { coalesce, createSemaphore } from '../../src/runtime/server/util/security'

describe('coalesce', () => {
  it('deduplicates concurrent calls with the same key', async () => {
    let callCount = 0
    const fn = () => {
      callCount++
      return new Promise<string>(resolve => setTimeout(resolve, 10, 'result'))
    }
    const [a, b, c] = await Promise.all([
      coalesce('key1', fn),
      coalesce('key1', fn),
      coalesce('key1', fn),
    ])
    expect(callCount).toBe(1)
    expect(a).toBe('result')
    expect(b).toBe('result')
    expect(c).toBe('result')
  })

  it('allows different keys to run independently', async () => {
    let callCount = 0
    const fn = () => {
      callCount++
      return Promise.resolve('ok')
    }
    await Promise.all([coalesce('a', fn), coalesce('b', fn)])
    expect(callCount).toBe(2)
  })

  it('cleans up after completion so subsequent calls re-execute', async () => {
    let callCount = 0
    const fn = () => {
      callCount++
      return Promise.resolve(callCount)
    }
    const first = await coalesce('x', fn)
    const second = await coalesce('x', fn)
    expect(first).toBe(1)
    expect(second).toBe(2)
  })
})

describe('createSemaphore', () => {
  it('limits concurrent execution', async () => {
    const sem = createSemaphore(2)
    let running = 0
    let maxRunning = 0

    const task = async () => {
      await sem.acquire()
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise(r => setTimeout(r, 20))
      running--
      sem.release()
    }

    await Promise.all([task(), task(), task(), task(), task()])
    expect(maxRunning).toBe(2)
  })

  it('reports active and waiting counts', async () => {
    const sem = createSemaphore(1)
    await sem.acquire()
    expect(sem.active).toBe(1)

    const waiting = sem.acquire()
    expect(sem.waiting).toBe(1)

    sem.release()
    await waiting
    expect(sem.active).toBe(1)
    expect(sem.waiting).toBe(0)
    sem.release()
  })
})
