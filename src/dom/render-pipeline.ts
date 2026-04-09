import type { Pencere } from "../core"
import type { Translator } from "../i18n"
import type { ImageItem, Item } from "../types"
import { computeAspectRatio, defaultImageLoader } from "./image-loader"
import type { ImageLoader, ImageLoaderOptions } from "./image-loader"
import type { LiveRegion } from "./live-region"
import { pickRenderer } from "./renderers"
import type { Renderer } from "./renderers"

export interface ActiveRendererSlot {
  renderer: Renderer
  el: HTMLElement
  item: Item
}

export interface RenderSlideContext<T extends Item = Item> {
  core: Pencere<T>
  slot: HTMLElement
  caption: HTMLElement
  longDescription: HTMLElement
  counter: HTMLElement
  prevButton: HTMLButtonElement
  nextButton: HTMLButtonElement
  liveRegion: LiveRegion
  t: Translator
  renderers?: Renderer[]
  image?: ImageLoaderOptions
  /** Injectable loader. Defaults to `defaultImageLoader`. */
  imageLoader?: ImageLoader
  loop?: boolean
  viewTransition: boolean
  /** Current renderer mount (video/iframe/html) to tear down before re-render. */
  activeRenderer: ActiveRendererSlot | null
  /** Called when a non-image slide mounts. Host stores for teardown. */
  setActiveRenderer: (slot: ActiveRendererSlot | null) => void
  /** Called when an image mounts — host updates transform/will-change target. */
  setCurrentImg: (img: HTMLImageElement | null) => void
  /** Abort signal for the current load (aborts on slide change / close). */
  signal: AbortSignal
  /** Reset gesture transform — called at the start of every render. */
  resetTransform: () => void
  /** Write the current gesture transform onto the freshly-mounted image. */
  applyCurrentTransform: (img: HTMLImageElement) => void
}

/**
 * Render pipeline (#ref: AGENTS.md Phase 1). Orchestrates slide
 * rendering in four stages: prepare → load → compose → display.
 *
 * - prepare: tear down previous renderer, reset transform, update
 *   counter / live region / caption / long description / nav buttons
 * - load: either invoke the renderer registry (non-image) or the
 *   image loader (image)
 * - compose: attach the loaded element into the slot
 * - display: commit post-mount state (placeholder fade, transform,
 *   slideLoad event)
 *
 * The four stages are internal; consumers call `renderSlide(ctx)`.
 */
export async function renderSlide<T extends Item>(ctx: RenderSlideContext<T>): Promise<void> {
  const item = prepareSlide(ctx)
  if (item.type !== "image") {
    await loadNonImage(ctx, item)
    return
  }
  await loadAndDisplayImage(ctx, item as ImageItem)
}

function prepareSlide<T extends Item>(ctx: RenderSlideContext<T>): Item {
  const item = ctx.core.item
  // Tear down the previous renderer-backed slide (video / iframe
  // / custom) so autoplay videos pause, iframe src unloads, etc.
  if (ctx.activeRenderer) {
    const { renderer, el, item: previous } = ctx.activeRenderer
    try {
      renderer.unmount?.(el, previous as never)
    } catch {
      /* ignore renderer teardown errors */
    }
    ctx.setActiveRenderer(null)
  }
  ctx.resetTransform()
  // Update counter + live region unconditionally.
  const total = ctx.core.state.items.length
  const index = ctx.core.state.index + 1
  ctx.counter.textContent = ctx.t("counter", { index, total })
  ctx.liveRegion.announce(`${ctx.t("counter", { index, total })}${item.alt ? `: ${item.alt}` : ""}`)
  // Captions are textContent by default (issue #48).
  ctx.caption.textContent =
    "caption" in item && typeof item.caption === "string" ? item.caption : ""
  // Propagate `lang` so AT switches voices + CJK / Arabic font
  // stacks kick in via the `--pc-font-*` custom properties (#65).
  const lang = "lang" in item ? (item as { lang?: string }).lang : undefined
  if (lang) {
    ctx.caption.setAttribute("lang", lang)
    ctx.longDescription.setAttribute("lang", lang)
  } else {
    ctx.caption.removeAttribute("lang")
    ctx.longDescription.removeAttribute("lang")
  }
  // Long description lives in a visually hidden, aria-described-by
  // node so AT users get the full descriptor without crowding the
  // visible caption line (#26).
  ctx.longDescription.textContent =
    "longDescription" in item &&
    typeof (item as { longDescription?: string }).longDescription === "string"
      ? (item as { longDescription: string }).longDescription
      : ""
  // Disable prev/next at ends when loop is off.
  const loop = ctx.loop ?? true
  ctx.prevButton.disabled = !loop && ctx.core.state.index === 0
  ctx.nextButton.disabled = !loop && ctx.core.state.index === total - 1
  return item
}

async function loadNonImage<T extends Item>(ctx: RenderSlideContext<T>, item: Item): Promise<void> {
  // Non-image slide types flow through the renderer registry
  // (#8). User-supplied renderers run first; built-in video /
  // iframe / html renderers ship as fallbacks.
  ctx.slot.textContent = ""
  const renderer = pickRenderer(item, ctx.renderers)
  if (!renderer) {
    ctx.slot.textContent = `pencere: no renderer for item type "${item.type}"`
    return
  }
  try {
    const mounted = await renderer.mount(item, {
      document: ctx.slot.ownerDocument,
      signal: ctx.signal,
    })
    if (ctx.signal.aborted) {
      renderer.unmount?.(mounted, item as never)
      return
    }
    ctx.slot.appendChild(mounted)
    ctx.setActiveRenderer({ renderer, el: mounted, item })
    ctx.setCurrentImg(null)
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      ctx.slot.textContent = `pencere: renderer failed (${(err as Error).message})`
    }
  }
}

async function loadAndDisplayImage<T extends Item>(
  ctx: RenderSlideContext<T>,
  imageItem: ImageItem,
): Promise<void> {
  ctx.slot.style.setProperty("--pc-slot-ar", computeAspectRatio(imageItem))
  // ThumbHash / BlurHash style placeholder (#29). Paint the
  // consumer-supplied low-res hint under the slot so the user
  // sees a chromatic silhouette instantly instead of an empty
  // void while the full-res image decodes.
  if (imageItem.placeholder) {
    ctx.slot.style.setProperty("--pc-slot-placeholder", imageItem.placeholder)
    ctx.slot.classList.add("pc-slot--placeholder")
  } else {
    ctx.slot.style.removeProperty("--pc-slot-placeholder")
    ctx.slot.classList.remove("pc-slot--placeholder")
  }

  try {
    const loader = ctx.imageLoader ?? defaultImageLoader
    const { element, image } = await loader.load(imageItem, ctx.signal, ctx.image)
    if (ctx.signal.aborted) return
    // The transform target is always the <img>, even when the
    // loader wrapped it in a <picture> for AVIF/WebP fallback.
    image.classList.add("pc-img")
    if (ctx.viewTransition) {
      image.style.setProperty("view-transition-name", "pencere-hero")
    }
    ctx.slot.textContent = ""
    ctx.slot.appendChild(element)
    // Drop the placeholder once the decoded image is in the slot
    // (#29). A small rAF gives the browser a frame to commit the
    // image layer before we fade the hint out. Re-check the abort
    // signal inside the rAF so a close() between image decode and
    // next frame doesn't mutate a detached slot.
    requestAnimationFrame(() => {
      if (ctx.signal.aborted) return
      ctx.slot.classList.remove("pc-slot--placeholder")
    })
    ctx.setCurrentImg(image)
    ctx.applyCurrentTransform(image)
    ctx.core.events.emit("slideLoad", {
      index: ctx.core.state.index,
      item: imageItem as unknown as T,
    })
  } catch (err) {
    if ((err as Error).name === "AbortError") return
    ctx.slot.textContent = "Image failed to load"
  }
}
