import { existsSync } from 'node:fs'
import type { TinyWSRequest } from 'tinyws'
import type { NodeIncomingMessage, NodeServerResponse } from 'h3'
import type { WebSocket } from 'ws'
import { createBirpcGroup } from 'birpc'
import type { ChannelOptions } from 'birpc'
import { parse, stringify } from 'flatted'
import type { Nuxt } from '@nuxt/schema'
import { resolve } from 'pathe'
import type { PlaygroundClientFunctions, PlaygroundServerFunctions } from './runtime/types'
import type { ModuleOptions } from './module'

export function setupPlaygroundRPC(nuxt: Nuxt, config: ModuleOptions) {
  const serverFunctions: PlaygroundServerFunctions = {
    getConfig() {
      return config
    },
    async openInEditor(input: string) {
      if (input.startsWith('./'))
        input = resolve(process.cwd(), input)

      // separate line and column syntax
      const match = input.match(/^(.*?)([:\d]*)$/)
      let suffix = ''
      if (match) {
        input = match[1]
        suffix = match[2]
      }

      // search for existing file
      const file = [
        input,
        `${input}.js`,
        `${input}.mjs`,
        `${input}.ts`,
      ].find(i => existsSync(i))
      if (file) {
        // @ts-expect-error missin types
        await import('launch-editor').then(r => (r.default || r)(file + suffix))
      }
      else {
        console.error('File not found:', input)
      }
    },
  }

  const clients = new Set<WebSocket>()
  const birpc = createBirpcGroup<PlaygroundClientFunctions>(serverFunctions, [])

  nuxt.hook('builder:watch', (e, path) => {
    if (e === 'change')
      birpc.broadcast.refresh.asEvent(path)
  })

  const middleware = async (req: NodeIncomingMessage & TinyWSRequest, res: NodeServerResponse) => {
    // Handle WebSocket
    if (req.ws) {
      const ws = await req.ws()
      clients.add(ws)
      const channel: ChannelOptions = {
        post: d => ws.send(d),
        on: fn => ws.on('message', fn),
        serialize: stringify,
        deserialize: parse,
      }
      birpc.updateChannels((c) => {
        c.push(channel)
      })
      ws.on('close', () => {
        clients.delete(ws)
        birpc.updateChannels((c) => {
          const index = c.indexOf(channel)
          if (index >= 0)
            c.splice(index, 1)
        })
      })
    }
    else if (req.method === 'POST') {
      const body = await getBodyJson(req)
      if (body.method === 'setPayload') {
        // TODO:
      }
      else {
        res.statusCode = 400
      }
      res.end()
    }
  }

  return {
    middleware,
    birpc,
  }
}

function getBodyJson(req: NodeIncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('error', reject)
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) || {})
      }
      catch (e) {
        reject(e)
      }
    })
  })
}
