import type { Browser } from 'puppeteer-core'
import type { H3Event } from 'h3'
import puppeteer from '@cloudflare/puppeteer'
import { useRuntimeConfig } from '#imports'

let browser: Browser | null = null
let browserPromise: Promise<Browser> | null = null

export async function createBrowser(event?: H3Event): Promise<Browser> {
  // Prevent race conditions with concurrent requests
  if (browser?.connected)
    return browser
  if (browserPromise)
    return browserPromise

  const bindingName = useRuntimeConfig().ogImage.browser?.binding
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
    // Reuse existing sessions when possible (Cloudflare best practice)
    const sessions = await puppeteer.sessions(binding)
    const existingSession = sessions.find((s: { connected: boolean }) => !s.connected)

    if (existingSession) {
      browser = await puppeteer.connect(binding, existingSession.id)
    }
    else {
      browser = await puppeteer.launch(binding)
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
