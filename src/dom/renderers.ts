/**
 * Custom renderer registry (#8).
 *
 * A renderer is a plain object that claims a subset of item types
 * and knows how to mount them inside the viewer slot. The default
 * image path stays hard-wired in `PencereViewer.renderSlide` for
 * performance, but every other type (video, iframe, html, custom:*)
 * flows through this registry.
 *
 * First-party renderers ship as separate subpaths (`pencere/video`,
 * `pencere/iframe`, …). Consumers register any additional renderer
 * via `PencereViewerOptions.renderers`.
 */

import type { Item } from "../types"

export interface RendererContext {
  /** The current document — useful for `createElement` on shadow-root setups. */
  document: Document
  /** AbortSignal that fires when the slide is replaced; renderers must
   *  cancel any pending work attached to it. */
  signal: AbortSignal
}

export interface Renderer<I extends Item = Item> {
  /**
   * Return `true` if this renderer can mount the given item. The
   * registry walks renderers in order and picks the first match.
   */
  canHandle(item: Item): item is I
  /** Mount the item into a fresh element; the viewer inserts the result into the slot. */
  mount(item: I, ctx: RendererContext): HTMLElement | Promise<HTMLElement>
  /**
   * Optional teardown. Called with the element returned from
   * `mount` when the viewer navigates away or closes. Useful for
   * releasing Blob URLs, detaching event listeners, stopping
   * videos, etc.
   */
  unmount?(element: HTMLElement, item: I): void
}

/**
 * Default first-party iframe renderer. Sandboxed by default to keep
 * untrusted remote content from reaching the parent document.
 */
export const iframeRenderer: Renderer = {
  canHandle(item): item is Extract<Item, { type: "iframe" }> {
    return item.type === "iframe"
  },
  mount(item, ctx) {
    const frame = ctx.document.createElement("iframe")
    const typedItem = item as Extract<Item, { type: "iframe" }>
    frame.src = typedItem.src
    frame.setAttribute("sandbox", typedItem.sandbox ?? "allow-scripts allow-same-origin")
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")
    frame.setAttribute("loading", "eager")
    frame.setAttribute("allow", "fullscreen")
    frame.title = typedItem.alt ?? "Embedded content"
    frame.style.width = "100%"
    frame.style.height = "100%"
    frame.style.border = "0"
    return frame
  },
}

/**
 * Default first-party HTML renderer. Accepts either a raw HTML string
 * (routed through textContent to avoid XSS — consumers should pre-
 * sanitize via Trusted Types if they need rich content) or a builder
 * function returning an HTMLElement.
 */
export const htmlRenderer: Renderer = {
  canHandle(item): item is Extract<Item, { type: "html" }> {
    return item.type === "html"
  },
  mount(item, ctx) {
    const typedItem = item as Extract<Item, { type: "html" }>
    if (typeof typedItem.html === "function") return typedItem.html()
    const wrap = ctx.document.createElement("div")
    // textContent by default — consumers needing real HTML should
    // call `createTrustedTypesPolicy` and write to a child themselves
    // via the html factory variant above.
    wrap.textContent = typedItem.html
    return wrap
  },
}

/**
 * Default first-party `<video>` renderer. Autoplays muted when
 * requested; otherwise the browser's controls ship disabled-by-
 * default so non-sighted users do not hear audio land unexpectedly.
 */
export const videoRenderer: Renderer = {
  canHandle(item): item is Extract<Item, { type: "video" }> {
    return item.type === "video"
  },
  mount(item, ctx) {
    const typedItem = item as Extract<Item, { type: "video" }>
    const video = ctx.document.createElement("video")
    video.src = typedItem.src
    if (typedItem.poster) video.poster = typedItem.poster
    video.controls = true
    video.playsInline = true
    if (typedItem.autoplay) {
      video.muted = true
      video.autoplay = true
    }
    video.setAttribute("crossorigin", "anonymous")
    video.style.maxWidth = "100%"
    video.style.maxHeight = "100%"
    return video
  },
  unmount(el) {
    const v = el as HTMLVideoElement
    v.pause()
    v.removeAttribute("src")
    v.load()
  },
}

/** Built-in renderers that always fire last, after any user renderers. */
export const BUILT_IN_RENDERERS: Renderer[] = [videoRenderer, iframeRenderer, htmlRenderer]

/** Pick the first renderer (user-supplied first, built-ins last) that can handle the item. */
export function pickRenderer(item: Item, user: Renderer[] = []): Renderer | null {
  for (const r of user) if (r.canHandle(item)) return r
  for (const r of BUILT_IN_RENDERERS) if (r.canHandle(item)) return r
  return null
}
