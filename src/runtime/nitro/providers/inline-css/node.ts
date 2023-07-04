import inlineCss from 'inline-css'

function nodeFn(html: string, options: any) {
  return inlineCss(html, {
    ...options,
    applyLinkTags: false,
    removeLinkTags: false,
    removeStyleTags: false,
  })
}
nodeFn.__mock = false

export default nodeFn
