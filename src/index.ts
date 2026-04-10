export type {
  CloseReason,
  CustomItem,
  HtmlItem,
  IframeItem,
  ImageItem,
  Item,
  PencereEvents,
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
  bindPencere,
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
  BindOptions,
  DialogControllerOptions,
  FocusTrapOptions,
  KeyboardAction,
  KeyboardMapOptions,
  Unbind,
} from "./dom"
export { computeAspectRatio, defaultImageLoader, loadImage } from "./dom/image-loader"
export type { ImageLoader, ImageLoaderOptions, ImageLoadResult } from "./dom/image-loader"
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
export { RoutingController, resolveRouting } from "./dom/routing-controller"
export type {
  ResolvedRouting,
  RoutingControllerOptions,
  RoutingOptions,
} from "./dom/routing-controller"
export { FullscreenController } from "./dom/fullscreen-controller"
export type { FullscreenControllerOptions } from "./dom/fullscreen-controller"
export { ViewTransitionController } from "./dom/view-transition-controller"
export type { ViewTransitionControllerOptions } from "./dom/view-transition-controller"
export { MotionController } from "./dom/motion-controller"
export type { MotionControllerOptions } from "./dom/motion-controller"
export {
  animateZoomPan,
  zoomPanTrajectory,
  transformToView,
  viewToTransform,
} from "./dom/zoom-pan-curve"
export type { ZoomPanView } from "./dom/zoom-pan-curve"
export { renderSlide, safeUnmount } from "./dom/render-pipeline"
export type { ActiveRendererSlot, RenderSlideContext } from "./dom/render-pipeline"
export type { Renderer, RendererContext } from "./dom/renderers"
export type {
  CloseHookContext,
  NavigateHookContext,
  OpenHookContext,
  PencereHooks,
  RenderHookContext,
} from "./dom/hooks"
export type { PencereContext, PencerePlugin } from "./dom/plugin"
export { slideshowPlugin } from "./dom/plugins/slideshow"
export type { SlideshowPluginOptions } from "./dom/plugins/slideshow"

import { Pencere } from "./core"
import type { ImageItem } from "./types"

export interface CreatePencereResult {
  readonly index: number
  readonly item: ImageItem
  readonly length: number
  next(): Promise<ImageItem>
  prev(): Promise<ImageItem>
  goTo(index: number): Promise<ImageItem>
  pencere: Pencere<ImageItem>
}

/**
 * Lightweight factory for image-only galleries.
 * For full control use `new Pencere(options)` directly.
 */
export function createPencere(options: {
  items: Array<Omit<ImageItem, "type"> | ImageItem>
  startIndex?: number
  loop?: boolean
}): CreatePencereResult {
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
