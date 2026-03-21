export interface CreateComponentOptions {
  name: string
  renderer: 'satori' | 'browser' | 'takumi'
  pageFile: string
}

export interface ServerFunctions {
  ejectCommunityTemplate: (path: string) => Promise<string>
  createComponent: (options: CreateComponentOptions) => Promise<string>
  addOgImageToPage: (componentName: string, pageFile: string) => Promise<boolean>
}

export interface ClientFunctions {
  refresh: () => void
  refreshRouteData: (path: string) => void
  refreshGlobalData: () => void
}
