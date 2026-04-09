export type {
  CloseReason,
  CustomItem,
  HtmlItem,
  IframeItem,
  ImageItem,
  Item,
  PencereEvents,
  PencereItem,
  PencereOptions,
  VideoItem,
} from "./types"
export { PencereError, PencereIndexError, PencereStateError } from "./errors"
export { Emitter } from "./emitter"
export { Pencere } from "./core"
export type { PencereState } from "./core"
export { createTrustedTypesPolicy, escapeHtml, isSafeUrl, safeUrl } from "./security"
export type { PencereTrustedTypePolicy } from "./security"
export {
  DialogController,
  FocusTrap,
  firstTabbable,
  getTabbable,
  isTabbable,
  lastTabbable,
  lockScroll,
  resolveKeyAction,
  unlockScroll,
} from "./dom"
export type {
  DialogControllerOptions,
  FocusTrapOptions,
  KeyboardAction,
  KeyboardMapOptions,
} from "./dom"
export { computeAspectRatio, loadImage } from "./dom/image-loader"
export type { ImageLoaderOptions, ImageLoadResult } from "./dom/image-loader"
export { GestureEngine } from "./dom/gesture"
export type { GestureEngineOptions, GestureEventType, GestureSnapshot } from "./dom/gesture"
export {
  clampScale,
  distance,
  IDENTITY,
  midpoint,
  scaleAround,
  toCss as transformToCss,
  translate,
} from "./dom/transform"
export type { Transform2D } from "./dom/transform"
export { classifySwipe, computeVelocity, runMomentum } from "./dom/momentum"
export type { VelocitySample } from "./dom/momentum"
export { SwipeNavigator } from "./dom/swipe-nav"
export type { SwipeAxis, SwipeNavigatorOptions, SwipeRelease } from "./dom/swipe-nav"
export { LiveRegion } from "./dom/live-region"
export { createMediaQuery, prefersReducedMotion } from "./dom/media-query"
export type { MediaQueryHandle } from "./dom/media-query"
export { createTranslator, DEFAULT_STRINGS } from "./i18n"
export type { PencereStrings, Translator } from "./i18n"
export { getStrings, strings as i18nBundles } from "./i18n-bundles"
export type { PencereLocale } from "./i18n-bundles"
export { PencereViewer } from "./dom/viewer"
export type { PencereViewerOptions } from "./dom/viewer"

import { Pencere } from "./core"
import type { ImageItem } from "./types"

/**
 * Lightweight factory for image-only galleries.
 * For full control use `new Pencere(options)` directly.
 */
export function createPencere(options: {
  items: Array<Omit<ImageItem, "type"> | ImageItem>
  startIndex?: number
  loop?: boolean
}) {
  const items: ImageItem[] = options.items.map((it) =>
    "type" in it && it.type === "image" ? it : { type: "image", ...it },
  )
  const instance = new Pencere<ImageItem>({
    items,
    startIndex: options.startIndex,
    loop: options.loop,
  })
  // Open immediately for backward compatibility with initial scaffold.
  void instance.open(options.startIndex)
  return {
    get index(): number {
      return instance.state.index
    },
    get item(): ImageItem {
      return instance.item
    },
    get length(): number {
      return instance.state.items.length
    },
    async next(): Promise<ImageItem> {
      await instance.next()
      return instance.item
    },
    async prev(): Promise<ImageItem> {
      await instance.prev()
      return instance.item
    },
    async goTo(index: number): Promise<ImageItem> {
      await instance.goTo(index)
      return instance.item
    },
    pencere: instance,
  }
}
