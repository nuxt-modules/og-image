// Define a type for NuxtIslandResponse since it's imported from a module we don't have direct access to
export interface NuxtIslandResponse {
  html: string
  head: { link: string[], style: string[], script: string[] }
  state: Record<string, any>
  [key: string]: any
}
