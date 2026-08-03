import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'

async function main() {
  const portServer = createServer()
  portServer.listen(0, '127.0.0.1')
  await once(portServer, 'listening')
  const port = portServer.address().port
  portServer.close()
  await once(portServer, 'close')

  const origin = `http://127.0.0.1:${port}`
  const nitroManifest = JSON.parse(await readFile(new URL('.output/nitro.json', import.meta.url), 'utf8'))
  assert.equal(nitroManifest.versions.nitro, '3.0.260610-beta')

  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: 'inherit',
  })

  async function waitForServer() {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (server.exitCode !== null)
        throw new Error(`Nuxt 5 server exited with code ${server.exitCode}`)
      const response = await fetch(`${origin}/_og/debug.json`, {
        signal: AbortSignal.timeout(1_000),
      }).catch((error) => {
        // Timeouts and refused connections are expected until the child server is ready.
        if (error instanceof TypeError || error?.name === 'TimeoutError')
          return null
        throw error
      })
      if (response?.ok)
        return response
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Nuxt 5 server did not start')
  }

  try {
    const response = await waitForServer()
    const body = await response.json()
    assert.equal(body.siteConfigUrl, 'https://og-image.example.com')
    assert.equal(body.runtimeConfig.version, '6.7.5')
  }
  finally {
    server.kill()
    if (server.exitCode === null)
      await once(server, 'exit')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
