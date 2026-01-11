import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from './module'
import type { BindingVariant, ProviderName } from './utils/dependencies'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { getPresetNitroPresetCompatibility, resolveNitroPreset } from './compatibility'
import { logger } from './runtime/logger'
import {
  ensureProviderDependencies,
  getInstalledProviders,
  getMissingDependencies,
  getProviderDependencies,
  getRecommendedBindingFromPreset,
  isPackageInstalled,
  PROVIDER_DEPENDENCIES,
  validateProviderSetup,
} from './utils/dependencies'

const DEPRECATED_CONFIG: Record<string, string> = {
  playground: 'Removed - use Nuxt DevTools',
  host: 'Use site.url or NUXT_SITE_URL',
  siteUrl: 'Use site.url or NUXT_SITE_URL',
  runtimeBrowser: 'Use compatibility.runtime.chromium',
  runtimeSatori: 'Use compatibility.runtime.satori',
  cacheTtl: 'Use cacheMaxAgeSeconds',
  cache: 'Use cacheMaxAgeSeconds',
  cacheKey: 'Removed',
  static: 'Removed - use zeroRuntime',
}

const DEPRECATED_COMPOSABLES = [
  'defineOgImageStatic',
  'defineOgImageDynamic',
  'defineOgImageCached',
  'defineOgImageWithoutCache',
  'OgImageStatic',
  'OgImageDynamic',
  'OgImageCached',
  'OgImageWithoutCache',
]

interface OnboardingState {
  selectedRenderer?: ProviderName
  selectedBinding?: BindingVariant
  createStarterComponent?: boolean
}

export async function onInstall(nuxt: Nuxt): Promise<void> {
  // skip if NUXT_OG_IMAGE_SKIP_ONBOARDING=1
  if (process.env.NUXT_OG_IMAGE_SKIP_ONBOARDING === '1') {
    logger.info('Skipping onboarding (NUXT_OG_IMAGE_SKIP_ONBOARDING=1)')
    return
  }

  logger.info('')
  logger.info('┌─────────────────────────────────────────┐')
  logger.info('│  nuxt-og-image                          │')
  logger.info('└─────────────────────────────────────────┘')
  logger.info('')

  const state: OnboardingState = {}

  // check existing installed providers
  const installedProviders = await getInstalledProviders()

  if (installedProviders.length > 0) {
    logger.info('Detected installed providers:')
    for (const { provider, binding } of installedProviders) {
      logger.info(`  - ${provider} (${binding})`)
    }

    const useExisting = await logger.prompt('Use detected providers?', {
      type: 'confirm',
      initial: true,
    })

    if (useExisting && installedProviders[0]) {
      // use first detected as default
      state.selectedRenderer = installedProviders[0].provider
      state.selectedBinding = installedProviders[0].binding
    }
  }

  // prompt for renderer selection if not already set
  if (!state.selectedRenderer) {
    const rendererChoice = await logger.prompt('Select a renderer:', {
      type: 'select',
      options: PROVIDER_DEPENDENCIES.map(p => ({
        label: p.name,
        value: p.name,
        hint: p.description,
      })),
    })

    if (typeof rendererChoice === 'symbol') {
      logger.warn('Onboarding cancelled')
      return
    }

    state.selectedRenderer = rendererChoice as ProviderName
  }

  // prompt for binding variant based on nitro preset
  if (!state.selectedBinding) {
    const recommendedBinding = getRecommendedBindingFromPreset(state.selectedRenderer!)
    const providerDef = PROVIDER_DEPENDENCIES.find(p => p.name === state.selectedRenderer)
    const hasNodeBinding = !!providerDef?.bindings.node
    const hasWasmBinding = !!providerDef?.bindings.wasm || !!providerDef?.bindings['wasm-fs']

    if (hasNodeBinding && hasWasmBinding) {
      // build options with recommended first
      const options = []
      if (recommendedBinding === 'node' || recommendedBinding === 'wasm-fs') {
        options.push({ label: 'node (Recommended)', value: 'node', hint: 'Native bindings (faster)' })
        options.push({ label: 'wasm', value: recommendedBinding === 'wasm-fs' ? 'wasm-fs' : 'wasm', hint: 'WASM bindings (portable)' })
      }
      else {
        options.push({ label: 'wasm (Recommended)', value: 'wasm', hint: 'WASM bindings (required for your platform)' })
        options.push({ label: 'node', value: 'node', hint: 'Native bindings (may not work on edge)' })
      }

      const bindingChoice = await logger.prompt('Select binding type:', {
        type: 'select',
        options,
      })

      if (typeof bindingChoice === 'symbol') {
        logger.warn('Onboarding cancelled')
        return
      }

      state.selectedBinding = bindingChoice as BindingVariant
    }
    else {
      state.selectedBinding = hasNodeBinding ? 'node' : 'wasm'
    }
  }

  // check and install dependencies
  const missing = await getMissingDependencies(state.selectedRenderer!, state.selectedBinding!)

  if (missing.length > 0) {
    logger.info(`Required dependencies for ${state.selectedRenderer} (${state.selectedBinding}):`)
    for (const pkg of missing) {
      logger.info(`  - ${pkg}`)
    }

    const installDeps = await logger.prompt('Install missing dependencies?', {
      type: 'confirm',
      initial: true,
    })

    if (installDeps) {
      const result = await ensureProviderDependencies(
        state.selectedRenderer!,
        state.selectedBinding!,
        nuxt,
      )

      if (result.success) {
        logger.success(`Installed: ${result.installed.join(', ')}`)
      }
      else {
        logger.error('Failed to install some dependencies. Install manually:')
        const allDeps = getProviderDependencies(state.selectedRenderer!, state.selectedBinding!)
        logger.info(`  npm add ${allDeps.join(' ')}`)
      }
    }
    else {
      const allDeps = getProviderDependencies(state.selectedRenderer!, state.selectedBinding!)
      logger.warn('Dependencies required. Install manually:')
      logger.info(`  npm add ${allDeps.join(' ')}`)
    }
  }
  else {
    logger.success(`All ${state.selectedRenderer} dependencies installed`)
  }

  // offer to create starter component
  const createComponent = await logger.prompt('Create starter OgImage component?', {
    type: 'confirm',
    initial: true,
  })

  if (createComponent) {
    await createStarterComponent(nuxt)
  }

  // check optional deps
  const hasSharp = await isPackageInstalled('sharp')
  if (!hasSharp && state.selectedRenderer === 'satori') {
    const wantJpeg = await logger.prompt('Install sharp for JPEG output support?', {
      type: 'confirm',
      initial: false,
    })

    if (wantJpeg) {
      await ensureProviderDependencies('satori', 'node', nuxt)
        .catch(() => logger.warn('Failed to install sharp, JPEG output unavailable'))
    }
  }

  // summary
  logger.info('')
  logger.info('┌─────────────────────────────────────────┐')
  logger.info('│  Setup Complete                         │')
  logger.info('├─────────────────────────────────────────┤')
  logger.info(`${`│  Renderer: ${state.selectedRenderer} (${state.selectedBinding})`.padEnd(42)}│`)
  logger.info('│                                         │')
  logger.info('│  Next steps:                            │')
  logger.info('│  1. Add site.url or NUXT_SITE_URL       │')
  logger.info('│  2. Open DevTools → OG Image            │')
  logger.info('│                                         │')
  logger.info('│  https://nuxtseo.com/og-image           │')
  logger.info('└─────────────────────────────────────────┘')
}

export async function onUpgrade(
  nuxt: Nuxt,
  _options: ModuleOptions,
  previousVersion: string,
): Promise<void> {
  logger.info('')
  logger.info('┌─────────────────────────────────────────┐')
  logger.info('│  nuxt-og-image upgraded                 │')
  logger.info(`${`│  ${previousVersion} → current`.padEnd(42)}│`)
  logger.info('└─────────────────────────────────────────┘')

  const issues: string[] = []

  // check for deprecated config
  const ogImageConfig = (nuxt.options as unknown as Record<string, unknown>).ogImage as Record<string, unknown> | undefined
  if (ogImageConfig) {
    for (const [key, replacement] of Object.entries(DEPRECATED_CONFIG)) {
      if (key in ogImageConfig) {
        issues.push(`Config \`${key}\` is deprecated: ${replacement}`)
      }
    }
  }

  // warn about deprecated composables (can't scan here, just inform)
  if (issues.length > 0) {
    logger.warn('Deprecated configuration detected:')
    for (const issue of issues) {
      logger.warn(`  - ${issue}`)
    }
  }

  logger.info('Check your code for deprecated composables:')
  for (const composable of DEPRECATED_COMPOSABLES) {
    logger.info(`  - ${composable}`)
  }

  // validate current provider setup using preset compatibility
  const renderer = (ogImageConfig?.defaults as { renderer?: ProviderName })?.renderer || 'satori'
  const preset = resolveNitroPreset()
  const compatibility = getPresetNitroPresetCompatibility(preset)
  const validation = await validateProviderSetup(renderer, compatibility)

  if (!validation.valid) {
    logger.warn('Provider setup issues:')
    for (const issue of validation.issues) {
      logger.warn(`  - ${issue}`)
    }
  }

  logger.info('Migration guide: https://nuxtseo.com/og-image/migration-guide')
}

async function createStarterComponent(nuxt: Nuxt): Promise<void> {
  const componentDir = join(nuxt.options.srcDir, 'components', 'OgImage')
  const componentPath = join(componentDir, 'Default.vue')

  if (existsSync(componentPath)) {
    logger.info('OgImage/Default.vue already exists, skipping')
    return
  }

  const template = `<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center items-center bg-gradient-to-br from-green-400 to-blue-500 text-white p-16">
    <h1 class="text-6xl font-bold mb-4">{{ title }}</h1>
    <p v-if="description" class="text-2xl opacity-80">{{ description }}</p>
  </div>
</template>
`

  if (!existsSync(componentDir))
    await mkdir(componentDir, { recursive: true }).catch(() => {})

  await writeFile(componentPath, template)
    .then(() => logger.success('Created components/OgImage/Default.vue'))
    .catch(() => logger.error('Failed to create starter component'))
}
