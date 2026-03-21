import { createTemplatePromise } from '@vueuse/core'

export const CreateOgImageDialogPromise = createTemplatePromise<string | false, [string]>()

export interface AddComponentResult {
  name: string
}

export const AddComponentDialogPromise = createTemplatePromise<AddComponentResult | false>()
