interface WorkerHandle {
  on: {
    (event: 'message', listener: (message: unknown) => void): WorkerHandle
    (event: 'error', listener: (error: Error) => void): WorkerHandle
    (event: 'exit', listener: (code: number) => void): WorkerHandle
  }
  postMessage: (message: unknown) => void
  removeAllListeners: () => WorkerHandle
  terminate: () => Promise<number>
  unref: () => void
}

interface QueueOptions {
  createWorker: () => WorkerHandle
  executionTimeout: number
  startupTimeout: number
  label: string
  maxAttempts?: number
}

type WorkerQueueEvent<TResponse>
  = { _tag: 'ready' }
    | { _tag: 'response', id: number, payload: TResponse }

interface Job<TMessage, TResponse> {
  id: number
  buildMessage: (context: { id: number, generation: number }) => TMessage
  resolve: (response: TResponse) => void
  reject: (error: Error) => void
  attempts: number
}

type ActiveState<TMessage, TResponse>
  = { _tag: 'idle' }
    | { _tag: 'waiting', job: Job<TMessage, TResponse> }
    | { _tag: 'running', job: Job<TMessage, TResponse>, timer: ReturnType<typeof setTimeout> }

type WorkerState
  = { _tag: 'stopped' }
    | { _tag: 'starting', generation: number, timer: ReturnType<typeof setTimeout>, worker: WorkerHandle }
    | { _tag: 'ready', generation: number, worker: WorkerHandle }

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason))
}

function parseWorkerEvent<TResponse>(message: unknown): WorkerQueueEvent<TResponse> | undefined {
  if (!message || typeof message !== 'object' || !('_tag' in message))
    return
  if (message._tag === 'ready')
    return { _tag: 'ready' }
  if (message._tag !== 'response' || !('id' in message) || typeof message.id !== 'number' || !('payload' in message))
    return
  return { _tag: 'response', id: message.id, payload: message.payload as TResponse }
}

export function parseWorkerTimeout(value: string | undefined, fallback = 30_000): number {
  const timeout = Number(value)
  return Number.isSafeInteger(timeout) && timeout > 0 ? timeout : fallback
}

export function createWorkerQueue<TMessage, TResponse>(options: QueueOptions) {
  const maxAttempts = options.maxAttempts ?? 2
  const queue: Array<Job<TMessage, TResponse>> = []
  let active: ActiveState<TMessage, TResponse> = { _tag: 'idle' }
  let workerState: WorkerState = { _tag: 'stopped' }
  let requestId = 0
  let workerGeneration = 0
  let stopped = false

  function stopWorker() {
    if (workerState._tag === 'stopped')
      return
    const state = workerState
    workerState = { _tag: 'stopped' }
    if (state._tag === 'starting')
      clearTimeout(state.timer)
    state.worker.removeAllListeners()
    void state.worker.terminate().catch(() => {
      // The worker may already be dead; queue state no longer depends on it.
    })
  }

  function takeActive(): Job<TMessage, TResponse> | undefined {
    if (active._tag === 'idle')
      return
    const state = active
    active = { _tag: 'idle' }
    if (state._tag === 'running')
      clearTimeout(state.timer)
    return state.job
  }

  function continueQueue() {
    queueMicrotask(processQueue)
  }

  function failWorker(reason: unknown, failedWorker?: WorkerHandle) {
    if (failedWorker && (workerState._tag === 'stopped' || workerState.worker !== failedWorker))
      return
    stopWorker()
    const job = takeActive()
    if (job) {
      if (job.attempts < maxAttempts) {
        job.attempts++
        queue.unshift(job)
      }
      else {
        job.reject(toError(reason))
      }
    }
    continueQueue()
  }

  function startWorker() {
    let newWorker: WorkerHandle
    try {
      newWorker = options.createWorker()
    }
    catch (error) {
      failWorker(error)
      return
    }

    const generation = ++workerGeneration
    const timer = setTimeout(() => {
      failWorker(new Error(`${options.label} worker startup timed out after ${options.startupTimeout}ms`), newWorker)
    }, options.startupTimeout)
    workerState = { _tag: 'starting', generation, timer, worker: newWorker }

    newWorker.on('message', (value) => {
      if (workerState._tag === 'stopped' || workerState.worker !== newWorker)
        return
      const message = parseWorkerEvent<TResponse>(value)
      if (!message)
        return
      if (message._tag === 'ready') {
        if (workerState._tag !== 'starting')
          return
        clearTimeout(workerState.timer)
        workerState = { _tag: 'ready', generation, worker: newWorker }
        dispatchActive()
        return
      }
      if (active._tag !== 'running' || active.job.id !== message.id)
        return
      const job = takeActive()!
      job.resolve(message.payload)
      processQueue()
    })
    newWorker.on('error', error => failWorker(error, newWorker))
    newWorker.on('exit', code => failWorker(new Error(`${options.label} worker exited with code ${code}`), newWorker))
    newWorker.unref()
  }

  function dispatchActive() {
    if (active._tag !== 'waiting' || workerState._tag !== 'ready')
      return
    const job = active.job
    const state = workerState
    const timer = setTimeout(() => {
      if (active._tag !== 'running' || active.job !== job)
        return
      stopWorker()
      takeActive()!.reject(new Error(`${options.label} render timed out after ${options.executionTimeout}ms`))
      continueQueue()
    }, options.executionTimeout)
    active = { _tag: 'running', job, timer }

    try {
      state.worker.postMessage(job.buildMessage({ id: job.id, generation: state.generation }))
    }
    catch (error) {
      stopWorker()
      takeActive()!.reject(toError(error))
      continueQueue()
    }
  }

  function processQueue() {
    if (stopped || active._tag !== 'idle')
      return
    const job = queue.shift()
    if (!job)
      return
    active = { _tag: 'waiting', job }
    if (workerState._tag === 'stopped')
      startWorker()
    else if (workerState._tag === 'ready')
      dispatchActive()
  }

  function enqueue(buildMessage: Job<TMessage, TResponse>['buildMessage']): Promise<TResponse> {
    if (stopped)
      return Promise.reject(new Error(`${options.label} worker queue is shut down`))
    return new Promise((resolve, reject) => {
      queue.push({ id: ++requestId, buildMessage, resolve, reject, attempts: 1 })
      processQueue()
    })
  }

  function shutdown() {
    stopped = true
    stopWorker()
    const error = new Error(`${options.label} worker terminated`)
    takeActive()?.reject(error)
    for (const job of queue.splice(0))
      job.reject(error)
  }

  return { enqueue, shutdown }
}
