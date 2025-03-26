export interface ServerFunctions {
  ejectCommunityTemplate: (path: string) => Promise<string>
}

export interface ClientFunctions {
  refresh: () => void
  refreshRouteData: (path: string) => void
  refreshGlobalData: () => void
}
