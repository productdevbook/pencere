/**
 * Solid adapter — `createPencereViewer` primitive.
 *
 * Solid's fine-grained reactivity means we instantiate the viewer
 * at creation time and tear it down via `onCleanup`.
 */
import { onCleanup } from "solid-js"

import { PencereViewer } from "../dom/viewer"
import type { PencereViewerOptions } from "../dom/viewer"
import type { Item } from "../types"

export interface CreatePencereViewerReturn<T extends Item = Item> {
  viewer: PencereViewer<T>
  open: (index?: number) => void
  close: () => void
}

export function createPencereViewer<T extends Item = Item>(
  options: PencereViewerOptions<T>,
): CreatePencereViewerReturn<T> {
  if (typeof window === "undefined") {
    throw new Error("pencere/solid: createPencereViewer requires a browser environment")
  }
  const viewer = new PencereViewer<T>(options)
  onCleanup(() => viewer.destroy())
  return {
    viewer,
    open: (index?: number) => void viewer.open(index),
    close: () => void viewer.close("api"),
  }
}
