import type { Nuxt } from '@nuxt/schema'
import type { NitroRuntimeCompatibility } from 'nuxtseo-shared/kit'
import type { ModuleOptions } from '../../src/module'
import { readFileSync } from 'node:fs'
import { join } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { typeTemplates } = vi.hoisted(() => ({
  typeTemplates: [] as Array<{ filename: string, getContents: (data: { nuxt?: Nuxt }) => string }>,
}))

vi.mock('@nuxt/kit', () => ({
  addTemplate: vi.fn(),
  addTypeTemplate: vi.fn((template: (typeof typeTemplates)[number]) => typeTemplates.push(template)),
}))

const { registerTypeTemplates } = await import('../../src/templates')

const nitroV2 = {
  _tag: 'nitro-v2',
  eventContextModule: 'h3',
  eventContextType: 'H3EventContext',
  eventType: 'import(\'h3\').H3Event',
  nitroTypesModule: 'nitropack',
} satisfies NitroRuntimeCompatibility

const nitroV3 = {
  _tag: 'nitro-v3',
  eventContextModule: 'srvx',
  eventContextType: 'ServerRequestContext',
  eventType: 'import(\'nitro/h3\').H3Event',
  nitroTypesModule: 'nitro/types',
} satisfies NitroRuntimeCompatibility

function renderAugmentations(nitroCompatibility: NitroRuntimeCompatibility): string {
  const nuxt = {
    hook: vi.fn(),
    options: {
      rootDir: '/project',
      buildDir: '/project/.nuxt',
    },
  } as unknown as Nuxt

  registerTypeTemplates({
    nuxt,
    config: { componentDirs: [] } as unknown as ModuleOptions,
    componentCtx: { components: [] },
    nitroCompatibility,
  })

  const template = typeTemplates.find(template => template.filename === 'types/og-image-augments.d.ts')
  expect(template).toBeDefined()
  return template!.getContents({ nuxt })
}

describe('nitro type templates', () => {
  beforeEach(() => {
    typeTemplates.length = 0
  })

  it('augments both Nitro 2 type entrypoints', () => {
    const contents = renderAugmentations(nitroV2)

    expect(contents.match(/interface NitroApp/g)).toHaveLength(2)
    expect(contents.match(/interface NitroRuntimeConfig/g)).toHaveLength(2)
    expect(contents).toContain('declare module \'nitropack\'')
    expect(contents).toContain('declare module \'nitropack/types\'')
  })

  it('augments the Nitro 3 type entrypoint', () => {
    const contents = renderAugmentations(nitroV3)

    expect(contents.match(/interface NitroApp/g)).toHaveLength(1)
    expect(contents.match(/interface NitroRuntimeConfig/g)).toHaveLength(1)
    expect(contents).toContain('declare module \'nitro/types\'')
  })

  it('keeps the Nitro runtime secret compatible with Nuxt runtime config', () => {
    const contents = renderAugmentations(nitroV2)

    expect(contents.match(/ogImage: \{\n\s+secret: string\n\s+\}/g)).toHaveLength(2)
  })

  it('keeps runtime types behind shared compatibility interfaces', () => {
    const runtimeTypes = readFileSync(join(import.meta.dirname, '../../src/runtime/types.ts'), 'utf8')
    const routeRulesPlugin = readFileSync(join(import.meta.dirname, '../../src/runtime/app/utils/plugins.ts'), 'utf8')
    const runtimeKit = readFileSync(join(import.meta.dirname, '../../src/runtime/server/util/kit.ts'), 'utf8')
    const module = readFileSync(join(import.meta.dirname, '../../src/module.ts'), 'utf8')

    expect(runtimeTypes).not.toMatch(/from ['"](?:nitropack|h3)/)
    expect(routeRulesPlugin).not.toMatch(/from ['"]nitropack/)
    expect(routeRulesPlugin).toContain('createNitroRouteRuleMatcher')
    expect(runtimeKit).toContain('import { fetchWithEvent, useRuntimeConfig } from \'#nuxtseo/nitro\'')
    expect(module).not.toContain('\'#og-image/nitro-fetch\'')
  })
})
