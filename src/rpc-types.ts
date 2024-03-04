export interface ServerFunctions {}

export interface ClientFunctions {
  refresh: () => void
  refreshRouteData: (path: string) => void
  refreshGlobalData: () => void
}
