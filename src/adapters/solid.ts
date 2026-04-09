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
    // SSR: return a no-op stub so components that call this at
    // render time don't crash the server. The client-side
    // rehydration will run this primitive again inside the
    // effectful scope where `window` is available.
    return {
      viewer: null as unknown as PencereViewer<T>,
      open: () => {},
      close: () => {},
    }
  }
  const viewer = new PencereViewer<T>(options)
  onCleanup(() => viewer.destroy())
  return {
    viewer,
    open: (index?: number) => void viewer.open(index),
    close: () => void viewer.close("api"),
  }
}
