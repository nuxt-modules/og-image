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

declare module '@takumi-rs/core' {
  export interface BaseNode {
    type: string
    tw?: string
    style?: Record<string, any>
  }

  export interface TextNode extends BaseNode {
    type: 'text'
    text: string
  }

  export interface ImageNode extends BaseNode {
    type: 'image'
    src: string
    width?: number
    height?: number
  }

  export interface ContainerNode extends BaseNode {
    type: 'container'
    children?: Node[]
  }

  export type Node = TextNode | ImageNode | ContainerNode

  export class Renderer {
    loadFont(font: { name: string, data: BufferSource, weight?: number, style?: 'normal' | 'italic' | 'oblique' }): Promise<number> | number
    render(node: Node, options: Record<string, any>): Uint8Array
    close?: () => Promise<void> | void
  }

  export function extractResourceUrls(node: Node): string[] | Promise<string[]>
}
