import type { OgImageComponent, RendererType } from '../runtime/types'
import { stripLiteral } from 'strip-literal'
import { createUnplugin } from 'unplugin'
import { matchesComponentName, parseComponentName } from '../util'

type UsageComponent = Pick<OgImageComponent, 'pascalName' | 'category' | 'renderer' | 'path'>

export interface OgImageUsageContext {
  components: UsageComponent[]
  browserEnabled: boolean
  /** renderers whose dependencies are missing, with the packages to install */
  missingRenderers?: Partial<Record<RendererType, string[]>>
  /** templates that route rules render */
  routeRuleReferences?: OgImageReferences
}

/** Which templates app code or route rules ask for. */
export interface OgImageReferences {
  /** literal component names, such as 'Card' or 'Card.takumi' */
  names: string[]
  /** a component name is built at runtime, so any template may be used */
  hasDynamicName: boolean
  /** an image names no component, so the default template renders */
  usesDefault: boolean
}

const RE_NAMED_CALL = /\b(defineOgImage(?:Component)?)\s*\(\s*(['"`])([\w.-]+)\2/g
const RE_SCREENSHOT_CALL = /\bdefineOgImageScreenshot\s*\(/g
const RE_ANY_CALL = /\bdefineOgImage(?:Component)?\s*\(/g
const RE_VUE_OR_SCRIPT = /\.(?:vue|[cm]?[jt]sx?)$/

/**
 * Find OG image calls that build fine but can never render in production:
 * a community template that was not ejected, or a screenshot without a browser renderer.
 */
export function findOgImageUsageErrors(code: string, ctx: OgImageUsageContext): string[] {
  if (!code.includes('defineOgImage'))
    return []
  // Blank out strings and comments, so only real calls count. Offsets stay the same.
  const stripped = stripLiteral(code)
  const errors: string[] = []

  for (const match of code.matchAll(RE_NAMED_CALL)) {
    if (!stripped.startsWith(match[1]!, match.index))
      continue
    const name = match[3]!
    const { renderer } = parseComponentName(name)
    const matches = ctx.components.filter(c =>
      matchesComponentName(c.pascalName, name) && (!renderer || c.renderer === renderer),
    )
    if (matches.length > 0 && matches.every(c => c.category === 'community'))
      errors.push(`\`${match[1]}('${name}')\` uses a community template that is not ejected. Production builds do not include community templates. Run: npx nuxt-og-image eject ${name}`)
  }

  if (!ctx.browserEnabled && RE_SCREENSHOT_CALL.test(stripped))
    errors.push('`defineOgImageScreenshot()` needs the browser renderer. Set ogImage.browser to true or a browser provider in nuxt.config.ts, or remove the call.')
  RE_SCREENSHOT_CALL.lastIndex = 0

  return errors
}

/**
 * Collect the template names that OG image calls in one module ask for.
 */
export function collectOgImageReferences(code: string): OgImageReferences {
  const refs: OgImageReferences = { names: [], hasDynamicName: false, usesDefault: false }
  if (!code.includes('defineOgImage'))
    return refs
  const stripped = stripLiteral(code)
  const literalCalls = new Set<number>()
  for (const match of code.matchAll(RE_NAMED_CALL)) {
    if (!stripped.startsWith(match[1]!, match.index))
      continue
    literalCalls.add(match.index)
    refs.names.push(match[3]!)
  }
  for (const match of stripped.matchAll(RE_ANY_CALL)) {
    if (!literalCalls.has(match.index))
      refs.hasDynamicName = true
  }
  return refs
}

/**
 * Collect the templates that `ogImage` route rules render.
 */
export function collectRouteRuleReferences(routeRules: Record<string, { ogImage?: unknown }> | undefined): OgImageReferences {
  const refs: OgImageReferences = { names: [], hasDynamicName: false, usesDefault: false }
  for (const rule of Object.values(routeRules || {})) {
    const ogImage = rule?.ogImage
    if (!ogImage || typeof ogImage !== 'object')
      continue
    const component = (ogImage as { component?: unknown }).component
    if (typeof component === 'string')
      refs.names.push(component)
    else
      refs.usesDefault = true
  }
  return refs
}

function installHint(missing: string[]) {
  return `npx nypm add ${missing.join(' ')}`
}

/**
 * Decide what a missing renderer dependency means for this build. A template that the
 * build can see in use fails the build. A template that nothing uses only gets a warning,
 * so a stray file does not stop the build.
 */
export function checkMissingRendererUsage(input: {
  components: UsageComponent[]
  missingRenderers: Partial<Record<RendererType, string[]>>
  references: OgImageReferences
}): { errors: string[], warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const appComponents = input.components.filter(c => c.category !== 'community')
  const isMissing = (c: UsageComponent) => !!input.missingRenderers[c.renderer]?.length
  if (!appComponents.some(isMissing))
    return { errors, warnings }

  const used = new Set<UsageComponent>()
  for (const name of input.references.names) {
    const { renderer } = parseComponentName(name)
    const matches = appComponents.filter(c => matchesComponentName(c.pascalName, name) && (!renderer || c.renderer === renderer))
    for (const c of matches)
      used.add(c)
    const broken = matches.find(isMissing)
    if (broken && matches.every(isMissing))
      errors.push(`\`defineOgImage('${name}')\` uses ${broken.path || broken.pascalName}, but the ${broken.renderer} renderer is not installed. Run: ${installHint(input.missingRenderers[broken.renderer]!)}`)
  }
  // With no component named, the first app template renders.
  const fallback = appComponents[0]
  if (input.references.usesDefault && fallback) {
    used.add(fallback)
    if (isMissing(fallback))
      errors.push(`A route rule renders the default template ${fallback.path || fallback.pascalName}, but the ${fallback.renderer} renderer is not installed. Run: ${installHint(input.missingRenderers[fallback.renderer]!)}`)
  }

  const unused = appComponents.filter(c => isMissing(c) && !used.has(c))
  if (unused.length > 0) {
    const lines = unused.map(c => `  ${c.path || c.pascalName}: ${installHint(input.missingRenderers[c.renderer]!)}`)
    const why = input.references.hasDynamicName
      ? 'The build found a component name built at runtime, so it cannot tell whether they render. If one does, that image returns 500.'
      : 'No page or route rule uses them, so the build continues.'
    warnings.push(`These OG image templates need a renderer that is not installed:\n${lines.join('\n')}\n${why}`)
  }
  return { errors: [...new Set(errors)], warnings }
}

/**
 * Fail the production build when app code calls an OG image composable that cannot render.
 * Collects every error first, so one build reports all of them.
 */
export const OgImageUsageCheckPlugin = createUnplugin((options: { getContext: () => OgImageUsageContext, ignoreDirs: string[], warn: (message: string) => void }) => {
  const errors: string[] = []
  const references: OgImageReferences = { names: [], hasDynamicName: false, usesDefault: false }
  return {
    name: 'nuxt-og-image:usage-check',
    buildStart() {
      errors.length = 0
      references.names.length = 0
      references.hasDynamicName = false
      references.usesDefault = false
    },
    transform(code, id) {
      const [path] = id.split('?')
      if (!path || !RE_VUE_OR_SCRIPT.test(path) || path.includes('/node_modules/') || options.ignoreDirs.some(dir => path.startsWith(dir)))
        return
      for (const error of findOgImageUsageErrors(code, options.getContext()))
        errors.push(`${path}: ${error}`)
      const found = collectOgImageReferences(code)
      references.names.push(...found.names)
      references.hasDynamicName ||= found.hasDynamicName
    },
    buildEnd() {
      const ctx = options.getContext()
      const routeRules = ctx.routeRuleReferences
      const renderers = checkMissingRendererUsage({
        components: ctx.components,
        missingRenderers: ctx.missingRenderers || {},
        references: {
          names: [...references.names, ...(routeRules?.names || [])],
          hasDynamicName: references.hasDynamicName,
          usesDefault: !!routeRules?.usesDefault,
        },
      })
      errors.push(...renderers.errors)
      for (const warning of renderers.warnings)
        options.warn(warning)
      if (errors.length > 0)
        throw new Error(`[nuxt-og-image] OG images in this build cannot render:\n${[...new Set(errors)].map(e => `  ${e}`).join('\n')}`)
    },
  }
})
