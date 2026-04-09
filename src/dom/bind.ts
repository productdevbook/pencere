/**
 * Declarative DOM scanner (#7).
 *
 * `bindPencere(selector, opts)` wires up a delegated click handler
 * on `document` so any link matching the selector — typically
 * `[data-pencere]` — opens the lightbox. Items are collected lazily
 * on first click from sibling links sharing a `data-gallery` group,
 * so consumers never hand-maintain an \`items\` array in JavaScript.
 *
 * Returns an `Unbind` function that removes the listener and
 * destroys any viewer it created.
 *
 * Mirrors the Fancybox / GLightbox DX with a tenth of the code.
 */

import type { ImageItem } from "../types"
import { PencereViewer } from "./viewer"
import type { PencereViewerOptions } from "./viewer"

export interface BindOptions extends Omit<PencereViewerOptions<ImageItem>, "items"> {
  /**
   * Attribute used to group links into a single gallery. Defaults
   * to `"data-gallery"`. Links in the same group open the same
   * viewer instance and can be navigated with prev/next.
   */
  groupAttribute?: string
}

export type Unbind = () => void

interface BindEntry {
  viewer: PencereViewer<ImageItem> | null
  items: ImageItem[]
  trigger: HTMLElement | null
}

/**
 * Walk an anchor/element and produce an `ImageItem` from its
 * attributes. Recognised attributes (all optional except the
 * derived src):
 *
 * - `href` or `data-src`       → `src`
 * - `data-alt` / inner `<img>.alt` → `alt`
 * - `data-caption`             → `caption`
 * - `data-longdesc`            → `longDescription`
 * - `data-width` / `data-height` → `width` / `height`
 * - `data-srcset` / `data-sizes` → `srcset` / `sizes`
 * - `data-placeholder`         → `placeholder`
 * - `data-lang`                → `lang`
 */
function itemFromElement(el: Element): ImageItem | null {
  const src = (el as HTMLAnchorElement).getAttribute("href") ?? el.getAttribute("data-src")
  if (!src) return null
  const innerImg = el.querySelector("img")
  const alt =
    el.getAttribute("data-alt") ??
    innerImg?.getAttribute("alt") ??
    (el as HTMLAnchorElement).getAttribute("aria-label") ??
    undefined
  const width = el.getAttribute("data-width")
  const height = el.getAttribute("data-height")
  const item: ImageItem = { type: "image", src }
  if (alt !== undefined) item.alt = alt
  const caption = el.getAttribute("data-caption")
  if (caption !== null) item.caption = caption
  const longdesc = el.getAttribute("data-longdesc")
  if (longdesc !== null) item.longDescription = longdesc
  if (width !== null) item.width = Number.parseInt(width, 10)
  if (height !== null) item.height = Number.parseInt(height, 10)
  const srcset = el.getAttribute("data-srcset")
  if (srcset !== null) item.srcset = srcset
  const sizes = el.getAttribute("data-sizes")
  if (sizes !== null) item.sizes = sizes
  const placeholder = el.getAttribute("data-placeholder")
  if (placeholder !== null) item.placeholder = placeholder
  const lang = el.getAttribute("data-lang")
  if (lang !== null) item.lang = lang
  return item
}

/**
 * Bind a delegated click handler that opens a pencere viewer for
 * any element matching `selector`. Returns an unbind function.
 */
export function bindPencere(selector: string, options: BindOptions = {}): Unbind {
  const { groupAttribute = "data-gallery", ...rest } = options
  // One viewer instance per group key. Empty group key ("") means
  // ungrouped; each link is its own single-item gallery.
  const entries = new Map<string, BindEntry>()

  const onClick = (e: MouseEvent): void => {
    // Ignore modified clicks and non-primary buttons so the usual
    // "open in new tab" keybindings still work.
    if (e.defaultPrevented || e.button !== 0) return
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    const target = e.target as Element | null
    const match = target?.closest(selector) as HTMLElement | null
    if (!match) return
    const groupKey = match.getAttribute(groupAttribute) ?? ""
    // Collect all matching siblings that share this group key
    // every click — pages are dynamic and the DOM is the source of
    // truth. For ungrouped links, the list is just [match].
    const groupNodes = groupKey
      ? Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
          (n) => n.getAttribute(groupAttribute) === groupKey,
        )
      : [match]
    const items = groupNodes.map(itemFromElement).filter((x): x is ImageItem => x !== null)
    if (items.length === 0) return
    const index = Math.max(0, groupNodes.indexOf(match))

    let entry = entries.get(groupKey)
    // Rebuild the viewer when the item list changed since the last
    // click — otherwise reuse the cached instance so state survives
    // (scroll lock tracking, focus trap wiring, etc).
    const itemsUnchanged =
      entry &&
      entry.items.length === items.length &&
      entry.items.every((it, i) => it.src === items[i]!.src)
    if (!entry || !itemsUnchanged) {
      entry?.viewer?.destroy()
      entry = {
        viewer: new PencereViewer<ImageItem>({
          items,
          loop: true,
          ...rest,
        }),
        items,
        trigger: match,
      }
      entries.set(groupKey, entry)
    }
    e.preventDefault()
    // If the viewer is already open (user clicked a thumbnail while
    // navigating), treat the click as a goTo to avoid re-entering
    // the open pipeline.
    if (entry.viewer!.core.state.isOpen) {
      void entry.viewer!.core.goTo(index)
    } else {
      void entry.viewer!.open(index, match)
    }
  }

  document.addEventListener("click", onClick)
  return (): void => {
    document.removeEventListener("click", onClick)
    for (const entry of entries.values()) entry.viewer?.destroy()
    entries.clear()
  }
}
