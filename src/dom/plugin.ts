import type { Pencere } from "../core"
import type { Emitter } from "../emitter"
import type { Item, PencereEvents } from "../types"
import type { PencereHooks } from "./hooks"
import type { Renderer } from "./renderers"

/**
 * Narrow context handed to plugins at install time. Intentionally
 * smaller than the full `PencereViewer` class so plugins cannot
 * reach into private state or mutate internal controllers — keeps
 * the plugin contract stable across refactors.
 *
 * Plugins get:
 * - `core` — the state machine (read index, items, listen for events)
 * - `events` — shorthand for `core.events`
 * - `dom` — the mounted root / stage / slot nodes so visual
 *   plugins can mount their own UI alongside the viewer
 * - `hooks` — a way to register per-lifecycle hooks without
 *   clobbering user-supplied hooks or other plugins
 * - `renderers` — the live renderer registry (append to add a new
 *   renderer after construction)
 */
export interface PencereContext<T extends Item = Item> {
  /** Core state machine. */
  readonly core: Pencere<T>
  /** Shorthand for `core.events`. */
  readonly events: Emitter<PencereEvents<T>>
  /** Mounted DOM nodes. */
  readonly dom: {
    readonly root: HTMLDialogElement
    readonly stage: HTMLElement
    readonly slot: HTMLElement
  }
  /**
   * Register a lifecycle hook. Multiple plugins can register on
   * the same event; they run in install order. User-supplied
   * hooks on `PencereViewerOptions.hooks` run last so they can
   * observe/override plugin behaviour.
   *
   * Returns a disposer that detaches the hook — useful for
   * plugins that install hooks conditionally.
   */
  registerHook<K extends keyof PencereHooks<T>>(
    key: K,
    hook: NonNullable<PencereHooks<T>[K]>,
  ): () => void
  /** Append a renderer to the live registry. */
  registerRenderer(renderer: Renderer): () => void
}

/**
 * Plugin contract. `install` wires the plugin into the viewer and
 * returns an uninstall callback that `destroy()` will invoke.
 *
 * Options are baked into the plugin at construction time via a
 * factory (see `slideshowPlugin({ intervalMs: 4000 })`), not
 * passed at install — the viewer only knows `install(ctx)`.
 */
export interface PencerePlugin<T extends Item = Item> {
  /** Human-readable identifier — appears in warnings and DevTools. */
  readonly name: string
  /**
   * Set up the plugin. Return a synchronous uninstall function
   * that tears down every listener, DOM node, or renderer the
   * plugin created. The uninstall fires during `viewer.destroy()`.
   */
  install(ctx: PencereContext<T>): () => void
}

/**
 * Runtime container for plugin hook registrations. Used internally
 * by `PencereViewer` to multiplex multiple hooks on the same
 * lifecycle event.
 */
export class HookRegistry<T extends Item = Item> {
  private readonly map = new Map<
    keyof PencereHooks<T>,
    Array<(ctx: unknown) => void | Promise<void>>
  >()

  add<K extends keyof PencereHooks<T>>(key: K, hook: NonNullable<PencereHooks<T>[K]>): () => void {
    let list = this.map.get(key)
    if (!list) {
      list = []
      this.map.set(key, list)
    }
    list.push(hook as (ctx: unknown) => void | Promise<void>)
    return () => {
      const current = this.map.get(key)
      if (!current) return
      const idx = current.indexOf(hook as (ctx: unknown) => void | Promise<void>)
      if (idx >= 0) current.splice(idx, 1)
    }
  }

  get<K extends keyof PencereHooks<T>>(
    key: K,
  ): ReadonlyArray<(ctx: unknown) => void | Promise<void>> {
    return this.map.get(key) ?? []
  }

  clear(): void {
    this.map.clear()
  }
}
