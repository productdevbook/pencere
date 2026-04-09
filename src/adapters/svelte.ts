/**
 * Svelte adapter — `pencere` action usable via `use:pencere={options}`.
 *
 * Actions return lifecycle hooks for mount / unmount; this adapter
 * is framework-version agnostic (works with Svelte 3/4/5) because
 * it only uses the action contract, not runes.
 *
 * The attached node becomes the trigger. Click / Enter / Space on
 * the node opens the viewer, passing the node itself as the view
 * transition trigger so the UA morph animates from that spot on the
 * page. Consumers can bypass the trigger wiring by calling the
 * returned `open` directly.
 */
import { PencereViewer } from "../dom/viewer"
import type { PencereViewerOptions } from "../dom/viewer"
import type { Item } from "../types"

export interface PencereAction {
  /** Open the viewer programmatically. */
  open(index?: number): Promise<void>
  /** Close the viewer programmatically. */
  close(): Promise<void>
  /** Tear down the action — called automatically on node removal. */
  destroy(): void
}

export function pencere<T extends Item = Item>(
  node: HTMLElement,
  options: PencereViewerOptions<T>,
): PencereAction {
  if (typeof window === "undefined") {
    return {
      async open() {},
      async close() {},
      destroy() {},
    }
  }
  const viewer = new PencereViewer<T>(options)
  const onClick = (): void => {
    void viewer.open(options.startIndex, node)
  }
  node.addEventListener("click", onClick)
  return {
    open(index?: number) {
      return viewer.open(index ?? options.startIndex, node)
    },
    close() {
      return viewer.close()
    },
    destroy() {
      node.removeEventListener("click", onClick)
      viewer.destroy()
    },
  }
}
