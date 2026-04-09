/**
 * Scroll-lock helper that compensates for the scrollbar so locking
 * the body does not introduce layout shift.
 *
 * Supports nested activations: only the first `lock()` call applies
 * styles; the final `unlock()` restores them. State is keyed per
 * `Document` so nested lightboxes in iframes, popouts, or tests
 * that share a Vitest worker do not corrupt each other's counter.
 */
interface ScrollLockState {
  scrollY: number
  bodyStyle: string
  htmlOverflow: string
}

interface ScrollLockEntry {
  depth: number
  saved: ScrollLockState | null
}

const registry = new WeakMap<Document, ScrollLockEntry>()

function entry(doc: Document): ScrollLockEntry {
  let e = registry.get(doc)
  if (!e) {
    e = { depth: 0, saved: null }
    registry.set(doc, e)
  }
  return e
}

export function lockScroll(doc: Document = document): void {
  const e = entry(doc)
  e.depth += 1
  if (e.depth > 1) return
  const html = doc.documentElement
  const body = doc.body
  const view = doc.defaultView ?? window
  const scrollbarWidth = view.innerWidth - html.clientWidth
  e.saved = {
    scrollY: view.scrollY,
    bodyStyle: body.style.cssText,
    htmlOverflow: html.style.overflow,
  }
  body.style.paddingRight = `${scrollbarWidth}px`
  body.style.overflow = "hidden"
  // iOS Safari ignores overflow:hidden on body — pin via position:fixed.
  body.style.position = "fixed"
  body.style.top = `-${e.saved.scrollY}px`
  body.style.left = "0"
  body.style.right = "0"
  html.style.overflow = "hidden"
}

export function unlockScroll(doc: Document = document): void {
  const e = entry(doc)
  if (e.depth === 0) return
  e.depth -= 1
  if (e.depth > 0 || !e.saved) return
  const html = doc.documentElement
  const body = doc.body
  const view = doc.defaultView ?? window
  const { scrollY, bodyStyle, htmlOverflow } = e.saved
  body.style.cssText = bodyStyle
  html.style.overflow = htmlOverflow
  view.scrollTo(0, scrollY)
  e.saved = null
}

/**
 * Visible for testing. Resets the counter for the supplied document
 * (defaults to the global `document`). Tests that lock a custom
 * document (iframe, JSDOM alt-worker) must pass that same document
 * here, otherwise the stale entry lives until the document itself
 * is garbage collected.
 */
export function _resetScrollLock(doc?: Document): void {
  const target = doc ?? (typeof document !== "undefined" ? document : null)
  if (target) registry.delete(target)
}
