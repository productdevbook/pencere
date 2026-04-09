/**
 * Svelte 5 adapter — `pencere` action usable via `use:pencere={options}`.
 *
 * Actions return lifecycle hooks for mount / unmount; this adapter
 * is framework-version agnostic (works with Svelte 3/4/5) because
 * it only uses the action contract, not runes.
 */
import { PencereViewer } from "../dom/viewer"
import type { PencereViewerOptions } from "../dom/viewer"
import type { Item } from "../types"

export interface PencereAction {
  destroy(): void
}

export function pencere<T extends Item = Item>(
  _node: HTMLElement,
  options: PencereViewerOptions<T>,
): PencereAction {
  if (typeof window === "undefined") {
    return { destroy() {} }
  }
  const viewer = new PencereViewer<T>(options)
  void viewer.open(options.startIndex)
  return {
    destroy() {
      viewer.destroy()
    },
  }
}
