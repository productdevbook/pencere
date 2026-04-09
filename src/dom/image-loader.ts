import { safeUrl } from "../security"
import type { ImageItem } from "../types"

export interface ImageLoadResult {
  element: HTMLImageElement
  width: number
  height: number
}

export interface ImageLoaderOptions {
  /**
   * CORS attribute applied to created <img> elements.
   * Default: null (no attribute) for maximum compatibility.
   */
  crossOrigin?: "anonymous" | "use-credentials" | null
  /**
   * Referrer-policy applied to created <img> elements.
   * Default: "strict-origin-when-cross-origin" — safer than the
   * browser default which leaks the full URL cross-origin.
   */
  referrerPolicy?: ReferrerPolicy
}

/**
 * Load an image and await decode(), racing a timeout so a stalled
 * server cannot block the pipeline forever. Applies fetchpriority,
 * decoding hints, and referrer policy for safer defaults (issues
 * #27, #29 security axis).
 *
 * The loader is pure: it does NOT attach the element to the DOM.
 * Callers mount it wherever they need.
 */
export async function loadImage(
  item: ImageItem,
  signal: AbortSignal,
  opts: ImageLoaderOptions & { priority?: "high" | "low" | "auto" } = {},
): Promise<ImageLoadResult> {
  const href = safeUrl(item.src, typeof location !== "undefined" ? location.href : undefined)
  if (!href) {
    throw new Error(`pencere: unsafe image src rejected (${String(item.src).slice(0, 80)})`)
  }
  if (signal.aborted) throw abortError()

  const img = new Image()
  if (opts.crossOrigin != null) img.crossOrigin = opts.crossOrigin
  img.referrerPolicy = opts.referrerPolicy ?? "strict-origin-when-cross-origin"
  if (item.width) img.width = item.width
  if (item.height) img.height = item.height
  if (item.alt !== undefined) img.alt = item.alt
  if (item.srcset) img.srcset = item.srcset
  if (item.sizes) img.sizes = item.sizes
  // fetchpriority is still a new DOM property; assign via setAttribute
  // for maximum browser support.
  img.setAttribute("fetchpriority", opts.priority ?? "auto")
  img.decoding = "async"
  img.src = href

  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      cleanup()
      reject(abortError())
    }
    const onLoad = (): void => {
      cleanup()
      resolve()
    }
    const onError = (): void => {
      cleanup()
      reject(new Error(`pencere: image failed to load (${href})`))
    }
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort)
      img.removeEventListener("load", onLoad)
      img.removeEventListener("error", onError)
    }
    signal.addEventListener("abort", onAbort)
    img.addEventListener("load", onLoad)
    img.addEventListener("error", onError)
    // Short-circuit if already cached.
    if (img.complete && img.naturalWidth > 0) {
      cleanup()
      resolve()
    }
  })

  // Try to decode; ignore failures (some browsers reject on cached 0-sized).
  if (typeof img.decode === "function") {
    try {
      await Promise.race([img.decode(), new Promise((resolve) => setTimeout(resolve, 100))])
    } catch {
      // swallow — fallback to load event
    }
  }

  return {
    element: img,
    width: img.naturalWidth || item.width || 0,
    height: img.naturalHeight || item.height || 0,
  }
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError")
}

/**
 * Compute the CSS `aspect-ratio` string for a slot based on item
 * dimensions. Falls back to 3:2 when unknown.
 */
export function computeAspectRatio(item: { width?: number; height?: number }): string {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return `${item.width} / ${item.height}`
  }
  return "3 / 2"
}
