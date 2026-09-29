import type { OgImageComponent } from '../runtime/types'
import { stripLiteral } from 'strip-literal'
import { createUnplugin } from 'unplugin'
import { matchesComponentName, parseComponentName } from '../util'

export interface OgImageUsageContext {
  components: Pick<OgImageComponent, 'pascalName' | 'category' | 'renderer'>[]
  browserEnabled: boolean
}

const RE_NAMED_CALL = /\b(defineOgImage(?:Component)?)\s*\(\s*(['"`])([\w.-]+)\2/g
const RE_SCREENSHOT_CALL = /\bdefineOgImageScreenshot\s*\(/g
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
 * Fail the production build when app code calls an OG image composable that cannot render.
 * Collects every error first, so one build reports all of them.
 */
export const OgImageUsageCheckPlugin = createUnplugin((options: { getContext: () => OgImageUsageContext, ignoreDirs: string[] }) => {
  const errors: string[] = []
  return {
    name: 'nuxt-og-image:usage-check',
    buildStart() {
      errors.length = 0
    },
    transform(code, id) {
      const [path] = id.split('?')
      if (!path || !RE_VUE_OR_SCRIPT.test(path) || path.includes('/node_modules/') || options.ignoreDirs.some(dir => path.startsWith(dir)))
        return
      for (const error of findOgImageUsageErrors(code, options.getContext()))
        errors.push(`${path}: ${error}`)
    },
    buildEnd() {
      if (errors.length > 0)
        throw new Error(`[nuxt-og-image] OG images in this build cannot render:\n${[...new Set(errors)].map(e => `  ${e}`).join('\n')}`)
    },
  }
})
