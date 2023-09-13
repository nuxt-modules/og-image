import { inline } from 'css-inline'

function nodeFn(html: string, options: any) {
  return inline(html, {
    ...options,
    load_remote_stylesheets: false,
    keep_style_tags: false,
  })
}
nodeFn.__mock = false

export default nodeFn
