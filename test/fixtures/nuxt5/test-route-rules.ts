import assert from 'node:assert/strict'

export async function assertRouteRules(origin: string) {
  const response = await fetch(`${origin}/api/route-rules`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    config: { width: 640, height: 320, props: { title: 'Route rule title' } },
    resolved: { width: 640, height: 320, props: { title: 'Route rule title' } },
  })
}
