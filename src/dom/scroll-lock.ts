/**
 * Scroll-lock helper that compensates for the scrollbar so locking
 * the body does not introduce layout shift.
 *
 * Supports nested activations: only the first `lock()` call applies
 * styles; the final `unlock()` restores them.
 */
interface ScrollLockState {
  scrollY: number
  bodyStyle: string
  htmlOverflow: string
}

let depth = 0
let saved: ScrollLockState | null = null

export function lockScroll(doc: Document = document): void {
  depth += 1
  if (depth > 1) return
  const html = doc.documentElement
  const body = doc.body
  const scrollbarWidth = window.innerWidth - html.clientWidth
  saved = {
    scrollY: window.scrollY,
    bodyStyle: body.style.cssText,
    htmlOverflow: html.style.overflow,
  }
  body.style.paddingRight = `${scrollbarWidth}px`
  body.style.overflow = "hidden"
  // iOS Safari ignores overflow:hidden on body — pin via position:fixed.
  body.style.position = "fixed"
  body.style.top = `-${saved.scrollY}px`
  body.style.left = "0"
  body.style.right = "0"
  html.style.overflow = "hidden"
}

export function unlockScroll(doc: Document = document): void {
  if (depth === 0) return
  depth -= 1
  if (depth > 0 || !saved) return
  const html = doc.documentElement
  const body = doc.body
  const { scrollY, bodyStyle, htmlOverflow } = saved
  body.style.cssText = bodyStyle
  html.style.overflow = htmlOverflow
  window.scrollTo(0, scrollY)
  saved = null
}

/** Visible for testing. */
export function _resetScrollLock(): void {
  depth = 0
  saved = null
}
