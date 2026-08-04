import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createWorkerQueue } from '../../src/runtime/server/og-image/bindings/worker-queue'

interface Message {
  id: number
  failDispatch?: boolean
  value: string
}

interface Response {
  value: string
}

function createTestWorker(options: { crash?: boolean, ready?: boolean, respond?: boolean, responseDelay?: number } = {}) {
  const emitter = new EventEmitter()
  const worker = {
    on: (event: string, listener: (...args: any[]) => void) => {
      emitter.on(event, listener)
      return worker
    },
    postMessage: vi.fn((value: unknown) => {
      const message = value as Message
      if (message.failDispatch)
        throw new DOMException('could not be cloned', 'DataCloneError')
      if (options.crash) {
        queueMicrotask(() => emitter.emit('error', new Error('worker crashed')))
      }
      else if (options.respond !== false) {
        setTimeout(() => emitter.emit('message', { _tag: 'response', id: message.id, payload: { value: message.value } }), options.responseDelay ?? 0)
      }
    }),
    removeAllListeners: () => {
      emitter.removeAllListeners()
      return worker
    },
    terminate: vi.fn(() => Promise.resolve(0)),
    unref: vi.fn(() => worker),
  }

  if (options.ready !== false)
    queueMicrotask(() => emitter.emit('message', { _tag: 'ready' }))

  return worker
}

function enqueueValue(queue: ReturnType<typeof createWorkerQueue<Message, Response>>, value: string, failDispatch = false) {
  return queue.enqueue(({ id }) => ({ id, value, failDispatch })).then(response => response.value)
}

describe('worker queue', () => {
  it('starts the execution timeout only after each queued job is dispatched', async () => {
    const queue = createWorkerQueue<Message, Response>({
      createWorker: () => createTestWorker({ responseDelay: 15 }),
      executionTimeout: 30,
      startupTimeout: 30,
      label: 'test',
    })

    const started = Date.now()
    await expect(Promise.all([
      enqueueValue(queue, 'one'),
      enqueueValue(queue, 'two'),
      enqueueValue(queue, 'three'),
    ])).resolves.toEqual(['one', 'two', 'three'])
    expect(Date.now() - started).toBeGreaterThan(30)
    queue.shutdown()
  })

  it('rejects a synchronous dispatch failure and continues queued work', async () => {
    const createWorker = vi.fn(() => createTestWorker())
    const queue = createWorkerQueue<Message, Response>({
      createWorker,
      executionTimeout: 100,
      startupTimeout: 100,
      label: 'test',
    })

    const settled = await Promise.allSettled([
      enqueueValue(queue, 'bad', true),
      enqueueValue(queue, 'good'),
    ])

    expect(settled[0]).toMatchObject({ status: 'rejected', reason: { name: 'DataCloneError' } })
    expect(settled[1]).toEqual({ status: 'fulfilled', value: 'good' })
    expect(createWorker).toHaveBeenCalledTimes(2)
    queue.shutdown()
  })

  it('fails only a timed out render and continues queued work on a fresh worker', async () => {
    let workers = 0
    const queue = createWorkerQueue<Message, Response>({
      createWorker: () => createTestWorker({ respond: ++workers > 1 }),
      executionTimeout: 10,
      startupTimeout: 100,
      label: 'test',
    })

    const settled = await Promise.allSettled([
      enqueueValue(queue, 'stuck'),
      enqueueValue(queue, 'good'),
    ])

    expect(settled[0]).toMatchObject({ status: 'rejected', reason: { message: 'test render timed out after 10ms' } })
    expect(settled[1]).toEqual({ status: 'fulfilled', value: 'good' })
    expect(workers).toBe(2)
    queue.shutdown()
  })

  it('retries a crashed active job and preserves queued work', async () => {
    let workers = 0
    const queue = createWorkerQueue<Message, Response>({
      createWorker: () => createTestWorker({ crash: ++workers === 1 }),
      executionTimeout: 100,
      startupTimeout: 100,
      label: 'test',
    })

    await expect(Promise.all([
      enqueueValue(queue, 'retried'),
      enqueueValue(queue, 'queued'),
    ])).resolves.toEqual(['retried', 'queued'])
    expect(workers).toBe(2)
    queue.shutdown()
  })

  it('restarts a worker that never becomes ready', async () => {
    let attempts = 0
    const queue = createWorkerQueue<Message, Response>({
      createWorker: () => createTestWorker({ ready: ++attempts > 1 }),
      executionTimeout: 100,
      startupTimeout: 10,
      label: 'test',
    })

    await expect(enqueueValue(queue, 'recovered')).resolves.toBe('recovered')
    expect(attempts).toBe(2)
    queue.shutdown()
  })
})
