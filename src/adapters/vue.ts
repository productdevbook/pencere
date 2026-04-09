/**
 * Vue 3 adapter — a `usePencere` composable.
 *
 * `vue` is a peer dependency: the runtime imports below resolve
 * against the consumer's Vue install, and all viewer instantiation
 * is deferred to `onMounted` so SSR renders stay DOM-free.
 */
import { onBeforeUnmount, onMounted, ref } from "vue"
import type { Ref } from "vue"

import { PencereViewer } from "../dom/viewer"
import type { PencereViewerOptions } from "../dom/viewer"
import type { Item } from "../types"

export interface UsePencereReturn<T extends Item = Item> {
  viewer: Ref<PencereViewer<T> | null>
  open: (index?: number) => void
  close: () => void
}

export function usePencere<T extends Item = Item>(
  options: PencereViewerOptions<T>,
): UsePencereReturn<T> {
  const viewer = ref<PencereViewer<T> | null>(null) as Ref<PencereViewer<T> | null>
  onMounted(() => {
    if (typeof window === "undefined") return
    viewer.value = new PencereViewer<T>(options)
  })
  onBeforeUnmount(() => {
    viewer.value?.destroy()
    viewer.value = null
  })
  const open = (index?: number): void => {
    void viewer.value?.open(index)
  }
  const close = (): void => {
    void viewer.value?.close("api")
  }
  return { viewer, open, close }
}
