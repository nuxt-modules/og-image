import { inline } from 'css-inline'

function nodeFn(html: string, options: any) {
  return inline(html, {
    ...options,
    keep_link_tags: true,
    keep_style_tags: true,
  })
}
nodeFn.__mock = false

export default nodeFn
