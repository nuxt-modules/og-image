import type { InjectionKey, Ref } from 'vue'
import type { AsyncDataRequestStatus } from '#app'
import type { GlobalDebugResponse, PathDebugResponse } from './types'

export const GlobalDebugKey: InjectionKey<Ref<GlobalDebugResponse | null>> = Symbol('GlobalDebug')
export const PathDebugKey: InjectionKey<Ref<PathDebugResponse | null>> = Symbol('PathDebug')
export const PathDebugStatusKey: InjectionKey<Ref<AsyncDataRequestStatus>> = Symbol('PathDebugStatus')
export const RefetchPathDebugKey: InjectionKey<() => Promise<void>> = Symbol('RefetchPathDebug')
