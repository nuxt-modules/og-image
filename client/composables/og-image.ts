import type { Ref } from 'vue'
import type { DevToolsMetaDataExtraction, OgImageComponent, OgImageOptions, RendererType } from '../../src/runtime/types'
import { computed, inject, toValue, watch } from '#imports'
import { useLocalStorage, useWindowSize } from '@vueuse/core'
import defu from 'defu'
import { relative } from 'pathe'
import { hasProtocol, joinURL, parseURL, withQuery } from 'ufo'
import { ref } from 'vue'
import { encodeOgImageParams, separateProps } from '../../src/runtime/shared'
import { description, globalRefreshTime, hasMadeChanges, host, ogImageKey, options, optionsOverrides, path, propEditor, query, refreshSources, refreshTime, slowRefreshSources } from '../util/logic'
import { GlobalDebugKey, PathDebugKey, PathDebugStatusKey, RefetchPathDebugKey } from './keys'
import { colorMode, devtoolsClient, ogImageRpc } from './rpc'
import { CreateOgImageDialogPromise } from './templates'

export function useOgImage() {
  const globalDebug = inject(GlobalDebugKey, ref(null) as Ref<any>)

  const emojis = ref<OgImageOptions['emojis']>('noto')

  const debug = inject(PathDebugKey, ref(null) as Ref<any>)
  const debugStatus = inject(PathDebugStatusKey, ref('idle') as Ref<'idle' | 'pending' | 'success' | 'error'>)
  const refreshPathDebug = inject(RefetchPathDebugKey, async () => {})

  const isDebugLoading = computed(() => debugStatus.value === 'pending' && !debug.value?.extract?.options?.length)
  const error = ref(null)

  // Multi-image support
  const selectedOgImage = computed(() => {
    const images = debug.value?.extract?.socialPreview?.images || []
    return images.find((e: DevToolsMetaDataExtraction) => e.key === (ogImageKey.value || 'og')) || images[0]
  })

  const currentOptions = computed(() => {
    const opts = debug.value?.extract?.options || []
    return opts.find((o: OgImageOptions) => o.key === (ogImageKey.value || 'og')) || opts[0]
  })

  const isCustomOgImage = computed(() => {
    const url = toValue(currentOptions.value?.url)
    return url && !url.includes('/_og/')
  })

  const isValidDebugError = computed(() => {
    if (error.value) {
      // @ts-expect-error untyped
      const message = error.value.message
      if (message) {
        return message.includes('missing the #nuxt-og-') || message.includes('missing the Nuxt OG Image payload') || message.includes('Got invalid response')
      }
    }
    return false
  })

  const hasDefinedOgImage = computed(() => {
    const opts = debug.value?.extract?.options || []
    return opts.length > 0
  })

  const fetchError = computed(() => debug.value?.fetchError || null)

  watch(debug, (val) => {
    if (!val)
      return
    options.value = separateProps(toValue(currentOptions.value) || {}, ['socialPreview', 'options'])
    emojis.value = options.value.emojis
    if (!hasMadeChanges.value)
      propEditor.value = options.value.props || {}
  }, {
    immediate: true,
  })

  const defaults = computed(() => {
    return defu(globalDebug.value?.runtimeConfig.defaults, {
      height: 600,
      width: 1200,
    })
  })

  const height = computed((): number => {
    const h = toValue(optionsOverrides.value?.height)
    if (typeof h === 'number')
      return h
    const ogHeight = Number(selectedOgImage.value?.og?.['image:height'])
    if (ogHeight)
      return ogHeight
    return toValue(defaults.value.height) || 600
  })

  const width = computed((): number => {
    const w = toValue(optionsOverrides.value?.width)
    if (typeof w === 'number')
      return w
    const ogWidth = Number(selectedOgImage.value?.og?.['image:width'])
    if (ogWidth)
      return ogWidth
    return toValue(defaults.value.width) || 1200
  })

  const aspectRatio = computed(() => {
    return width.value / height.value
  })

  const imageFormat = computed(() => {
    return optionsOverrides.value?.extension || options.value?.extension || 'png'
  })

  const socialPreview = useLocalStorage('nuxt-og-image:social-preview', 'twitter')
  const imageColorMode = ref<'dark' | 'light'>(colorMode.value)

  const src = computed(() => {
    if (isCustomOgImage.value) {
      const url = toValue(currentOptions.value?.url) || ''
      if (hasProtocol(url, { acceptRelative: true })) {
        return url
      }
      return joinURL(host.value, url)
    }
    // Build encoded URL with options (Cloudinary-style)
    // Use defu to deep-merge props (shallow spread would drop original props like title)
    const params = defu(
      { key: ogImageKey.value || 'og', _path: path.value, _query: query.value },
      optionsOverrides.value,
      options.value,
    )
    const encoded = encodeOgImageParams(params)
    return withQuery(joinURL(host.value, `/_og/d/${encoded || 'default'}.${imageFormat.value}`), {
      timestamp: refreshTime.value, // Cache bust for devtools
      colorMode: imageColorMode.value, // Pass color mode to renderer
    })
  })

  const socialPreviewTitle = computed(() => {
    const root = debug.value?.extract?.socialPreview?.root || {}
    if (socialPreview.value === 'twitter' && root['twitter:title'])
      return root['twitter:title']
    return root['og:title']
  })

  const socialPreviewDescription = computed(() => {
    const root = debug.value?.extract?.socialPreview?.root || {}
    if (socialPreview.value === 'twitter' && root['twitter:description'])
      return root['twitter:description']
    return root['og:description']
  })

  const socialSiteUrl = computed(() => {
    return parseURL(globalDebug.value?.siteConfigUrl || '/').host || globalDebug.value?.siteConfigUrl || '/'
  })

  const slackSocialPreviewSiteName = computed(() => {
    return selectedOgImage.value?.og?.site_name || socialSiteUrl.value
  })

  function toggleSocialPreview(preview?: string) {
    if (!preview)
      socialPreview.value = ''
    else
      socialPreview.value = preview!
  }

  const activeComponentName = computed(() => {
    let componentName = String(optionsOverrides.value?.component || options.value?.component || 'NuxtSeo')
    for (const componentDirName of (globalDebug?.value?.runtimeConfig.componentDirs || [])) {
      componentName = componentName.replace(componentDirName, '')
    }
    return componentName
  })

  const activeComponent = computed(() => {
    const components = globalDebug.value?.componentNames || []
    const name = activeComponentName.value
    // Normalize dot-notation to PascalCase (NuxtSeo.takumi → NuxtSeoTakumi)
    const normalizedName = name.split('.').map((s, i) => i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)).join('')

    // First try exact match
    let matching = components.filter((c: OgImageComponent) => c.pascalName === normalizedName || c.pascalName === name)

    // If no exact match, try matching by base name (without renderer suffix)
    // This handles cases like component: 'BlogPost' matching 'BlogPostSatori'
    if (matching.length === 0) {
      const rendererSuffixes = ['Satori', 'Browser', 'Takumi']
      matching = components.filter((c: OgImageComponent) => {
        for (const suffix of rendererSuffixes) {
          if (c.pascalName.endsWith(suffix)) {
            const baseName = c.pascalName.slice(0, -suffix.length)
            if (baseName === normalizedName || baseName === name) {
              return true
            }
          }
        }
        return false
      })
    }

    // Prefer app components over community/pro templates
    return matching.find((c: OgImageComponent) => c.category === 'app') || matching[0]
  })

  const activeComponentRelativePath = computed(() => {
    const component = activeComponent.value
    if (!component?.path)
      return null

    const rootDir = globalDebug.value?.runtimeConfig?.rootDir
    if (rootDir) {
      return relative(rootDir, component.path)
    }

    return component.path
  })

  const isOgImageTemplate = computed(() => {
    const component = activeComponent.value
    return component?.path?.includes('node_modules') || component?.path?.includes('og-image/src/runtime/app/components/Templates/Community/')
  })

  // Derive renderer from: explicit override > options > active component > default
  const renderer = computed<RendererType>(() => {
    if (optionsOverrides.value?.renderer)
      return optionsOverrides.value.renderer
    if (options.value?.renderer)
      return options.value.renderer
    // Infer from active component's renderer
    return activeComponent.value?.renderer || 'satori'
  })

  const allComponents = computed<OgImageComponent[]>(() => {
    return globalDebug.value?.componentNames || []
  })

  // Components filtered by current renderer
  const componentNames = computed<OgImageComponent[]>(() => {
    const components = allComponents.value.filter(c => c.renderer === renderer.value)
    return [
      components.find((name: OgImageComponent) => name.pascalName === activeComponentName.value),
      ...components.filter((name: OgImageComponent) => name.pascalName !== activeComponentName.value),
    ].filter((c): c is OgImageComponent => Boolean(c))
  })

  const communityComponents = computed(() => {
    return componentNames.value.filter(c => c.category === 'community')
  })

  const appComponents = computed(() => {
    return componentNames.value.filter(c => c.category === 'app')
  })

  // Check if active component has a variant for a given renderer
  function getComponentVariantForRenderer(targetRenderer: RendererType): OgImageComponent | undefined {
    // Normalize dot-notation to PascalCase first (NuxtSeo.takumi → NuxtSeoTakumi)
    const normalized = activeComponentName.value.split('.').map((s, i) => i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)).join('')
    const currentBase = normalized
      .replace(/Satori$/, '')
      .replace(/Browser$/, '')
      .replace(/Takumi$/, '')
    return allComponents.value.find(c =>
      c.renderer === targetRenderer
      && (c.pascalName.replace(/Satori$/, '').replace(/Browser$/, '').replace(/Takumi$/, '') === currentBase),
    )
  }

  // Check if current component is compatible with selected renderer
  const isComponentCompatibleWithRenderer = computed(() => {
    const component = activeComponent.value
    if (!component)
      return true // No component selected
    return component.renderer === renderer.value
  })

  // Check which renderers have available components
  const availableRenderers = computed(() => {
    const renderers = new Set<RendererType>()
    for (const c of allComponents.value) {
      renderers.add(c.renderer)
    }
    return renderers
  })

  const windowSize = useWindowSize()
  const sidePanelOpen = useLocalStorage('nuxt-og-image:side-panel-open', windowSize.width.value >= 1024)

  watch(windowSize.width, (v) => {
    if (v < 1024 && sidePanelOpen.value)
      sidePanelOpen.value = false
  }, {
    immediate: true,
  })

  const isLoading = ref(false)

  function generateLoadTime(payload: { timeTaken: string, sizeKb: string }) {
    const extension = (imageFormat.value || '').toUpperCase()
    let rendererLabel = ''
    const r = renderer.value
    switch (imageFormat.value) {
      case 'png':
        rendererLabel = r === 'satori' ? 'Satori and ReSVG' : r === 'takumi' ? 'Takumi' : 'Browser'
        break
      case 'jpeg':
      case 'jpg':
        rendererLabel = r === 'satori' ? 'Satori, ReSVG and Sharp' : r === 'takumi' ? 'Takumi' : 'Browser'
        break
      case 'svg':
        rendererLabel = r === 'takumi' ? 'Takumi' : 'Satori'
        break
    }
    isLoading.value = false
    if (extension !== 'HTML') {
      if (isCustomOgImage.value) {
        description.value = `Loaded ${width.value}x${height.value} ${payload.sizeKb ? `${payload.sizeKb}kB` : ''} ${extension} in ${payload.timeTaken}ms.`
      }
      else {
        description.value = `Generated ${width.value}x${height.value} ${payload.sizeKb ? `${payload.sizeKb}kB` : ''} ${extension} ${rendererLabel ? `with ${rendererLabel}` : ''} in ${payload.timeTaken}ms.`
      }
    }
    else {
      description.value = ''
    }
  }

  watch([renderer, optionsOverrides], () => {
    description.value = 'Loading...'
    isLoading.value = true
  })

  function openImage() {
    window.open(src.value, '_blank')
  }

  const pageFile = computed(() => {
    const component = devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route.matched[0]?.components?.default as { __file?: string } | undefined
    return component?.__file
  })

  function openCurrentPageFile() {
    if (pageFile.value)
      devtoolsClient.value?.devtools.rpc.openInEditor(pageFile.value)
  }

  function openCurrentComponent() {
    const component = componentNames.value.find(c => c.pascalName === activeComponentName.value)
    if (component?.path)
      devtoolsClient.value?.devtools.rpc.openInEditor(component.path)
  }

  const isPageScreenshot = computed(() => {
    return activeComponentName.value === 'PageScreenshot'
  })

  function patchOptions(opts: OgImageOptions & { options?: unknown }) {
    delete opts.options
    optionsOverrides.value = defu(opts, optionsOverrides.value) as OgImageOptions
    hasMadeChanges.value = true
    refreshSources()
  }

  watch(emojis, (v) => {
    if (v !== options.value?.emojis) {
      patchOptions({
        emojis: v,
      })
    }
  })

  const currentPageFile = computed(() => {
    const component = devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route.matched[0]?.components?.default as { __file?: string } | undefined
    const path = component?.__file
    return `pages/${path?.split('pages/')[1]}`
  })

  async function ejectComponent(component: string) {
    const dir = await CreateOgImageDialogPromise.start(component)
    if (!dir)
      return
    const v = await ogImageRpc.value!.ejectCommunityTemplate(`${dir}/${component}.vue`)
    // Refresh component list so the ejected app component is picked up
    globalRefreshTime.value = Date.now()
    refreshSources()
    if (v)
      await devtoolsClient.value?.devtools.rpc.openInEditor(v)
  }

  async function resetProps(fetch = true) {
    if (fetch)
      await refreshPathDebug()
    optionsOverrides.value = {}
    hasMadeChanges.value = false
    if (fetch)
      refreshSources()
  }

  function updateProps(props: Record<string, any>) {
    optionsOverrides.value = defu({ props }, optionsOverrides.value)
    hasMadeChanges.value = true
    refreshSources()
  }

  // Multi-image keys
  const allImageKeys = computed(() => {
    return debug.value?.extract?.socialPreview?.images?.map((i: DevToolsMetaDataExtraction) => i.key) || []
  })

  return {
    // Data
    globalDebug,
    debug,
    isDebugLoading,
    error,
    emojis,

    // Computed
    selectedOgImage,
    currentOptions,
    isCustomOgImage,
    isValidDebugError,
    hasDefinedOgImage,
    fetchError,
    defaults,
    height,
    width,
    aspectRatio,
    imageFormat,
    socialPreview,
    imageColorMode,
    src,
    socialPreviewTitle,
    socialPreviewDescription,
    socialSiteUrl,
    slackSocialPreviewSiteName,
    activeComponentName,
    activeComponent,
    activeComponentRelativePath,
    isOgImageTemplate,
    renderer,
    allComponents,
    componentNames,
    communityComponents,
    appComponents,
    isComponentCompatibleWithRenderer,
    getComponentVariantForRenderer,
    availableRenderers,
    sidePanelOpen,
    isLoading,
    pageFile,
    isPageScreenshot,
    currentPageFile,
    allImageKeys,

    // Methods
    toggleSocialPreview,
    generateLoadTime,
    openImage,
    openCurrentPageFile,
    openCurrentComponent,
    patchOptions,
    ejectComponent,
    resetProps,
    updateProps,

    // Re-export from util/logic
    description,
    hasMadeChanges,
    options,
    optionsOverrides,
    propEditor,
    ogImageKey,
    refreshSources,
    slowRefreshSources,
  }
}
