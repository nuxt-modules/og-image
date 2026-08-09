import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const fixtureDir = import.meta.dirname
const imageSnapshotUrl = new URL('__snapshots__/og-image.png', import.meta.url)

async function assertImageSnapshot(imageBuffer) {
  if (process.env.UPDATE_OG_IMAGE_SNAPSHOT === 'true') {
    await mkdir(new URL('__snapshots__/', import.meta.url), { recursive: true })
    await writeFile(imageSnapshotUrl, imageBuffer)
    return
  }

  const actual = PNG.sync.read(imageBuffer)
  const expected = PNG.sync.read(await readFile(imageSnapshotUrl))
  assert.equal(actual.width, expected.width, 'Rendered OG image width changed')
  assert.equal(actual.height, expected.height, 'Rendered OG image height changed')

  const mismatchedPixels = pixelmatch(actual.data, expected.data, null, actual.width, actual.height, {
    includeAA: false,
    threshold: 0.1,
  })
  const mismatchRatio = mismatchedPixels / (actual.width * actual.height)
  assert.ok(mismatchRatio <= 0.001, `Rendered OG image differs from its snapshot by ${(mismatchRatio * 100).toFixed(3)}%`)
}

async function run(command, args) {
  const child = spawn(command, args, {
    cwd: fixtureDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      const text = chunk.toString()
      output += text
      process.stdout.write(text)
    })
  }
  const [exitCode] = await once(child, 'exit')
  assert.equal(exitCode, 0, `${command} ${args.join(' ')} exited with code ${exitCode}`)
  return output
}

async function main() {
  const buildOutput = await run('nuxt', ['build'])
  assert.doesNotMatch(buildOutput, /\[UNRESOLVED_IMPORT\]|Could not resolve ['"](?:nitropack\/runtime|h3)['"]/, 'Nuxt 5 build emitted a legacy Nitro import warning')

  const portServer = createServer()
  portServer.listen(0, '127.0.0.1')
  await once(portServer, 'listening')
  const port = portServer.address().port
  portServer.close()
  await once(portServer, 'close')

  const origin = `http://127.0.0.1:${port}`
  const nitroManifest = JSON.parse(await readFile(new URL('.output/nitro.json', import.meta.url), 'utf8'))
  const moduleManifest = JSON.parse(await readFile(new URL('node_modules/nuxt-og-image/package.json', import.meta.url), 'utf8'))
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
    assert.equal(body.runtimeConfig.version, moduleManifest.version)

    const pageResponse = await fetch(origin)
    assert.equal(pageResponse.status, 200)
    const html = await pageResponse.text()
    const imageUrl = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1]
    assert.ok(imageUrl, 'Rendered page is missing its og:image meta tag')

    const parsedImageUrl = new URL(imageUrl)
    const resolverResponse = await fetch(`${origin}/_og/r/`, {
      redirect: 'manual',
    })
    assert.equal(resolverResponse.status, 302)
    assert.equal(resolverResponse.headers.get('location'), imageUrl)

    const imageResponse = await fetch(`${origin}${parsedImageUrl.pathname}${parsedImageUrl.search}`, {
      headers: {
        'x-og-image-test': 'forwarded',
      },
    })
    assert.equal(imageResponse.status, 200)
    assert.equal(imageResponse.headers.get('content-type'), 'image/png')
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    assert.ok(imageBuffer.byteLength > 1_000, 'Rendered OG image is unexpectedly small')
    await assertImageSnapshot(imageBuffer)
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
