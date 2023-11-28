export interface ServerFunctions {}

export interface ClientFunctions {
  refreshRouteData(path: string): void
  refreshGlobalData(): void
}
