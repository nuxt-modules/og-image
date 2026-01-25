import type { InjectionKey, Ref } from 'vue'
import type { GlobalDebugResponse, PathDebugResponse } from './fetch'

export const GlobalDebugKey: InjectionKey<Ref<GlobalDebugResponse | null>> = Symbol('GlobalDebug')
export const PathDebugKey: InjectionKey<Ref<PathDebugResponse | null>> = Symbol('PathDebug')
export const RefetchPathDebugKey: InjectionKey<() => Promise<void>> = Symbol('RefetchPathDebug')
