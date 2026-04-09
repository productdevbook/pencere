/**
 * React adapter — a tiny hook wrapper around PencereViewer.
 *
 * Intentionally zero JSX: the entry exports only hooks so consumers
 * can render their own trigger elements. This keeps the adapter
 * framework-version agnostic and free of peer-dep drama.
 */
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import { PencereViewer } from "../dom/viewer";
import type { PencereViewerOptions } from "../dom/viewer";
import type { Item } from "../types";

export interface UseLightboxReturn<T extends Item = Item> {
  viewer: MutableRefObject<PencereViewer<T> | null>;
  open: (index?: number) => void;
  close: () => void;
}

/**
 * `useLightbox(options)` constructs a `PencereViewer` on mount and
 * destroys it on unmount. The returned `open` / `close` callbacks
 * are stable and can be passed to click handlers.
 *
 * Options are captured at mount time — changes to the items array
 * should be pushed via `viewer.current?.core.setItems(...)`.
 */
export function useLightbox<T extends Item = Item>(
  options: PencereViewerOptions<T>,
): UseLightboxReturn<T> {
  const viewer = useRef<PencereViewer<T> | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const instance = new PencereViewer<T>(optsRef.current);
    viewer.current = instance;
    return () => {
      instance.destroy();
      viewer.current = null;
    };
    // Intentionally empty: the viewer instance lifespan matches the
    // component. Options are read fresh from optsRef on each call.
  }, []);

  const open = (index?: number): void => {
    void viewer.current?.open(index);
  };
  const close = (): void => {
    void viewer.current?.close("api");
  };
  return { viewer, open, close };
}
