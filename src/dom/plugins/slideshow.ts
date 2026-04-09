import type { Item } from "../../types"
import type { PencereContext, PencerePlugin } from "../plugin"

export interface SlideshowPluginOptions {
  /** Delay between auto-advances, in ms. Default: 4000. */
  intervalMs?: number
  /** Auto-start when the viewer opens. Default: true. */
  autoStart?: boolean
  /** Pause on hover over the stage. Default: true. */
  pauseOnHover?: boolean
}

/**
 * Reference plugin (#4): auto-advance slideshow. Wires into
 * `didOpen` to start the timer, `didNavigate` to reset it, and
 * `willClose` to stop. On hover-capable devices pauses while the
 * stage is hovered.
 *
 * Proves the plugin contract surface:
 *   - narrow ctx (core + events + dom + registerHook)
 *   - no access to private viewer internals
 *   - clean uninstall that undoes every side effect
 */
export function slideshowPlugin<T extends Item = Item>(
  options: SlideshowPluginOptions = {},
): PencerePlugin<T> {
  const interval = options.intervalMs ?? 4000
  const autoStart = options.autoStart ?? true
  const pauseOnHover = options.pauseOnHover ?? true

  return {
    name: "slideshow",
    install(ctx: PencereContext<T>): () => void {
      let timer: ReturnType<typeof setTimeout> | null = null
      let paused = false

      const schedule = (): void => {
        if (timer) clearTimeout(timer)
        if (paused) return
        timer = setTimeout(() => {
          void ctx.core.next()
        }, interval)
      }

      const stop = (): void => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }

      const onEnter = (): void => {
        paused = true
        stop()
      }
      const onLeave = (): void => {
        paused = false
        schedule()
      }

      if (pauseOnHover) {
        ctx.dom.stage.addEventListener("pointerenter", onEnter)
        ctx.dom.stage.addEventListener("pointerleave", onLeave)
      }

      const disposers: Array<() => void> = []
      if (autoStart) {
        disposers.push(ctx.registerHook("didOpen", () => schedule()))
      }
      disposers.push(ctx.registerHook("didNavigate", () => schedule()))
      disposers.push(ctx.registerHook("willClose", () => stop()))

      return () => {
        stop()
        if (pauseOnHover) {
          ctx.dom.stage.removeEventListener("pointerenter", onEnter)
          ctx.dom.stage.removeEventListener("pointerleave", onLeave)
        }
        for (const d of disposers) d()
      }
    },
  }
}
