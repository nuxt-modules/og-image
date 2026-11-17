// Global type declarations for missing modules
declare module 'jest-image-snapshot' {
  export function toMatchImageSnapshot(options?: any): any
  export function configureToMatchImageSnapshot(options?: any): any
}

declare module 'nuxt/dist/core/runtime/nitro/renderer' {
  export const islandRenderer: any
}

declare module 'jest-image-snapshot' {
  export interface ToMatchImageSnapshotOptions {
    threshold?: number
    customDiffConfig?: {
      threshold?: number
    }
    allowSizeMismatch?: boolean
    failureThreshold?: number
    failureThresholdType?: 'pixel' | 'percent'
  }

  export declare function toMatchImageSnapshot(options?: ToMatchImageSnapshotOptions): {
    message: () => string
    pass: boolean
    actual?: any
    expected?: any
  }
}

declare module '@nuxt/test-utils/vitest' {
  interface VitestUtils {
    expect: {
      extend: (extensions: { toMatchImageSnapshot: any }) => void
    }
  }
}
