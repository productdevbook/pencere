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
} from "./types";
export { PencereError, PencereIndexError, PencereStateError } from "./errors";
export { Emitter } from "./emitter";
export { Pencere } from "./core";
export type { PencereState } from "./core";
export { escapeHtml, isSafeUrl, safeUrl } from "./security";

import type { ImageItem } from "./types";
import { Pencere } from "./core";

/**
 * Lightweight factory for image-only galleries.
 * For full control use `new Pencere(options)` directly.
 */
export function createPencere(options: {
  items: Array<Omit<ImageItem, "type"> | ImageItem>;
  startIndex?: number;
  loop?: boolean;
}) {
  const items: ImageItem[] = options.items.map((it) =>
    "type" in it && it.type === "image" ? it : { type: "image", ...it },
  );
  const instance = new Pencere<ImageItem>({
    items,
    startIndex: options.startIndex,
    loop: options.loop,
  });
  // Open immediately for backward compatibility with initial scaffold.
  void instance.open(options.startIndex);
  return {
    get index(): number {
      return instance.state.index;
    },
    get item(): ImageItem {
      return instance.item;
    },
    get length(): number {
      return instance.state.items.length;
    },
    async next(): Promise<ImageItem> {
      await instance.next();
      return instance.item;
    },
    async prev(): Promise<ImageItem> {
      await instance.prev();
      return instance.item;
    },
    async goTo(index: number): Promise<ImageItem> {
      await instance.goTo(index);
      return instance.item;
    },
    pencere: instance,
  };
}
