import type { H3Event } from 'h3'
import { useOgImageRuntimeConfig } from '../../../utils'

// Type definitions for Cloudflare puppeteer (user must install @cloudflare/puppeteer)
interface Browser {
  connected: boolean
  newPage: () => Promise<any>
  close: () => Promise<void>
  on: (event: string, handler: () => void) => void
}

interface CloudflarePuppeteer {
  sessions: (binding: any) => Promise<Array<{ id: string, connected: boolean }>>
  connect: (binding: any, sessionId: string) => Promise<Browser>
  launch: (binding: any) => Promise<Browser>
}

let puppeteer: CloudflarePuppeteer

async function getPuppeteer(): Promise<CloudflarePuppeteer> {
  if (!puppeteer) {
    // @ts-expect-error - optional dependency installed by user
    puppeteer = (await import('@cloudflare/puppeteer')).default
  }
  return puppeteer
}

let browser: Browser | null = null
let browserPromise: Promise<Browser> | null = null

export async function createBrowser(event?: H3Event): Promise<Browser> {
  // Prevent race conditions with concurrent requests
  if (browser?.connected)
    return browser
  if (browserPromise)
    return browserPromise

  const bindingName = useOgImageRuntimeConfig().browser?.binding
  if (!bindingName) {
    throw new Error(
      '[Nuxt OG Image] Browser binding name not configured. '
      + 'Set `ogImage.browser.binding` in nuxt.config.',
    )
  }

  const binding = event?.context?.cloudflare?.env?.[bindingName]
  if (!binding) {
    throw new Error(
      `[Nuxt OG Image] Cloudflare browser binding "${bindingName}" not found. `
      + 'Ensure it\'s configured in wrangler.toml and the request has cloudflare context.',
    )
  }

  browserPromise = (async () => {
    const pptr = await getPuppeteer()
    // Reuse existing sessions when possible (Cloudflare best practice)
    const sessions = await pptr.sessions(binding)
    const existingSession = sessions.find((s: { connected: boolean }) => !s.connected)

    if (existingSession) {
      browser = await pptr.connect(binding, existingSession.id)
    }
    else {
      browser = await pptr.launch(binding)
    }

    // Reset on disconnect (handles 60s idle timeout)
    browser!.on('disconnected', () => {
      browser = null
    })

    return browser!
  })()

  browser = await browserPromise
  browserPromise = null
  return browser
}

export async function disposeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
  }
}
