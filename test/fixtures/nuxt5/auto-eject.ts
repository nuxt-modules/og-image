import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'

const disabled = process.argv[2] === 'disabled'
if (disabled)
  process.env.NUXT_TEST_OG_DISABLED = '1'
const fixture = import.meta.dirname
// eslint-disable-next-line harlanzw/no-test-file-reads -- Preserve the isolated fixture input.
const originalApp = await readFile(join(fixture, 'app.vue'))
const serverApi = join(fixture, 'server/api/runtime-alias.ts')
// eslint-disable-next-line harlanzw/no-test-file-reads -- Preserve the isolated fixture input.
const originalApi = await readFile(serverApi)
if (disabled)
  await rm(serverApi)
const portServer = createServer()
portServer.listen(0, '127.0.0.1')
await once(portServer, 'listening')
const address = portServer.address()
assert.ok(address && typeof address !== 'string')
const port = address.port
portServer.close()
await once(portServer, 'close')

await writeFile(join(fixture, 'app.vue'), disabled
  ? `<script setup lang="ts">
import { defineOgImage, defineOgImageComponent, defineOgImageScreenshot } from '#og-image/app'
import { defineOgImage as deepDefine } from '#og-image/app/composables/defineOgImage'
import { defineOgImageComponent as deepComponent } from '#og-image/app/composables/defineOgImageComponent'
import { defineOgImageScreenshot as deepScreenshot } from '#og-image/app/composables/defineOgImageScreenshot'
defineOgImage('DisabledFixture', { title: 'Disabled mock' })
defineOgImageComponent('DisabledFixture')
defineOgImageScreenshot()
deepDefine('DisabledFixture')
deepComponent('DisabledFixture')
deepScreenshot()
</script>
<template><div>Disabled OG contract</div></template>
`
  : `<script setup lang="ts">
import { defineOgImage } from '#og-image/app'
defineOgImage('NuxtSeo.takumi', { title: 'Deferred community template copy' })
</script>
<template><div>Deferred community template copy</div></template>
`)
const output = join(fixture, 'components/OgImage/NuxtSeo.takumi.vue')
const server = spawn(process.execPath, [join(fixture, 'node_modules/nuxt/bin/nuxt.mjs'), 'dev', '--port', String(port), '--host', '127.0.0.1'], {
  cwd: fixture,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})
let log = ''
server.stdout?.on('data', chunk => log += chunk)
server.stderr?.on('data', chunk => log += chunk)
const origin = `http://127.0.0.1:${port}`
async function readHtml(): Promise<string> {
  // Connection failures and optimisation responses are expected during startup.
  const response = await fetch(origin, { signal: AbortSignal.timeout(1000) }).catch(() => {
    // The dev server can refuse connections during startup. Retry with the bounded wait.
    return undefined
  })
  if (!response || response.status === 503)
    return ''
  const body = await response.text()
  assert.equal(response.status, 200, body)
  return body
}
async function waitFor<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, log)
    const value = await read()
    if (accept(value))
      return value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Dev response timed out.\n${log}`)
}
try {
  if (disabled) {
    const html = await waitFor(readHtml, text => text.includes('Disabled OG contract'))
    assert.doesNotMatch(html, /nuxt-og-image-options|property="og:image"/)
    for (const project of ['app', 'server']) {
      const checker = spawn(process.execPath, [join(fixture, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit', '-p', `.nuxt/tsconfig.${project}.json`], { cwd: fixture, stdio: 'inherit' })
      const [code] = await once(checker, 'exit')
      assert.equal(code, 0, `Disabled ${project} types failed`)
    }
    console.log(`Disabled bare/deep mocks passed: ${process.env.NUXT_TEST_LANE}`)
  }
  else {
    await waitFor(() => fetch(`${origin}/_og/debug.json`, { signal: AbortSignal.timeout(1000) }).then(response => response.status).catch(() => 0), status => status === 200)
    // eslint-disable-next-line harlanzw/no-test-file-reads -- Observe the template-copy filesystem boundary.
    await assert.rejects(readFile(output), { code: 'ENOENT' })
    const html = await waitFor(readHtml, text => text.includes('Deferred community template copy'))
    assert.match(html, /nuxt-og-image-options/)
    // eslint-disable-next-line harlanzw/no-test-file-reads -- Observe the actual copied template.
    const template = await waitFor(() => readFile(output, 'utf8').catch((error) => {
      if (error.code === 'ENOENT')
        return ''
      throw error
    }), content => content.length > 0)
    assert.match(template, /<template>/)
    console.log(`Deferred auto-eject passed: ${process.env.NUXT_TEST_LANE}`)
  }
}
finally {
  if (server.exitCode === null && server.pid)
    process.kill(-server.pid, 'SIGTERM')
  if (server.exitCode === null)
    await once(server, 'exit')
  await writeFile(join(fixture, 'app.vue'), originalApp)
  if (disabled)
    await writeFile(serverApi, originalApi)
  await rm(join(fixture, 'components/OgImage/NuxtSeo.takumi.vue'), { force: true })
}
