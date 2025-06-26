// Extend existing interfaces for both Jest and Vitest
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot: (options?: import('jest-image-snapshot').ToMatchImageSnapshotOptions) => R
    }
  }
}

// Vitest interface extension
declare module 'vitest' {
  interface Assertion<T = any> {
    toMatchImageSnapshot: (options?: any) => T
  }
}

// Extend ImportMeta to include env property
declare global {
  interface ImportMeta {
    env?: Record<string, any>
  }
}

interface ImportMeta {
  env?: Record<string, any>
}

export {}
