export interface ImageItem {
  type: "image"
  src: string
  srcset?: string
  sizes?: string
  /**
   * `<picture>` source list — each entry becomes a `<source>` element
   * before the fallback `<img>`, so modern UAs can pick AVIF / WebP
   * while older ones fall back to `src`. No UA sniffing: the browser
   * does the picking via `type`/`media`/`srcset`.
   */
  sources?: Array<{
    type?: string
    srcset: string
    sizes?: string
    media?: string
  }>
  alt?: string
  width?: number
  height?: number
  caption?: string
  longDescription?: string
}

export interface VideoItem {
  type: "video"
  src: string
  poster?: string
  autoplay?: boolean
  alt?: string
  caption?: string
}

export interface IframeItem {
  type: "iframe"
  src: string
  sandbox?: string
  alt?: string
  caption?: string
}

export interface HtmlItem {
  type: "html"
  html: string | (() => HTMLElement)
  alt?: string
  caption?: string
}

export interface CustomItem<T = unknown> {
  type: `custom:${string}`
  data: T
  alt?: string
  caption?: string
}

export type Item = ImageItem | VideoItem | IframeItem | HtmlItem | CustomItem

export type CloseReason = "user" | "api" | "escape" | "backdrop"

export interface PencereEvents<T extends Item = Item> extends Record<string, unknown> {
  beforeOpen: { index: number; item: T }
  open: { index: number; item: T }
  beforeChange: { from: number; to: number }
  change: { from: number; to: number; item: T }
  slideLoad: { index: number; item: T }
  beforeClose: { reason: CloseReason }
  close: { reason: CloseReason }
  destroy: undefined
}

export interface PencereOptions<T extends Item = Item> {
  items: T[]
  startIndex?: number
  loop?: boolean
}

// Legacy alias kept for the initial scaffolding tests.
export type PencereItem = ImageItem
