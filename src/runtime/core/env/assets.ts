import { Buffer } from 'node:buffer'

export function toBase64Image(fileName: string, data: string | ArrayBuffer) {
  const base64 = typeof data === 'string' ? data : Buffer.from(data).toString('base64')
  let type = 'image/jpeg'
  // guess type from file name
  const ext = fileName.split('.').pop()
  if (ext === 'svg')
    type = 'image/svg+xml'
  else if (ext === 'png')
    type = 'image/png'
  return `data:${type};base64,${base64}`
}
