import type { CloseReason, Item } from "../types"

/**
 * Lifecycle hooks (Phase 2 of the v1.0 refactor). These let
 * plugins and controlled-mode consumers observe and gate viewer
 * transitions without having to subclass `PencereViewer` or patch
 * internal methods.
 *
 * `will*` hooks run before the transition and may be async — the
 * viewer awaits them, so long-running hooks block the user action.
 * Throwing from a `will*` hook aborts the transition (the error
 * propagates to the caller of `open()` / `close()`).
 *
 * `did*` hooks run after the transition has committed and are
 * fire-and-forget: thrown errors are swallowed with a console
 * warning so one misbehaving plugin can't take down the viewer.
 *
 * All hooks receive a small context object so plugins can read
 * state without reaching into the viewer instance.
 */
export interface PencereHooks<T extends Item = Item> {
  /** Called just before `core.open()` runs. Throw to abort the open. */
  willOpen?: (ctx: OpenHookContext<T>) => void | Promise<void>
  /** Called after the dialog is shown and the first render has committed. */
  didOpen?: (ctx: OpenHookContext<T>) => void | Promise<void>
  /** Called just before `core.close()` runs. Throw to abort the close. */
  willClose?: (ctx: CloseHookContext) => void | Promise<void>
  /** Called after the dialog is hidden. */
  didClose?: (ctx: CloseHookContext) => void | Promise<void>
  /** Called at the start of `renderSlide()` after prepare but before load. */
  willRender?: (ctx: RenderHookContext<T>) => void | Promise<void>
  /** Called after the slide is fully mounted into the slot. */
  didRender?: (ctx: RenderHookContext<T>) => void | Promise<void>
  /**
   * Called after the active slide index has changed. `willNavigate`
   * is intentionally omitted for now: navigation flows through
   * `core.next()` / `prev()` / `goTo()` directly from gestures and
   * keyboard, so a gating hook would require wrapping every call
   * site. Revisit in v1.1 alongside controlled mode (#6).
   */
  didNavigate?: (ctx: NavigateHookContext<T>) => void | Promise<void>
}

export interface OpenHookContext<T extends Item = Item> {
  /** Target index being opened (may be undefined → core resolves default). */
  index: number | undefined
  /** Element the user clicked to open, if any. */
  trigger?: HTMLElement
  /** Current (pre-open) item list. */
  items: readonly T[]
}

export interface CloseHookContext {
  reason: CloseReason
}

export interface RenderHookContext<T extends Item = Item> {
  index: number
  item: T
}

export interface NavigateHookContext<T extends Item = Item> {
  from: number
  to: number
  item: T
}

/**
 * Run a `will*` hook. Awaited so hook errors propagate to the
 * caller and can abort the action.
 */
export async function runWillHook<Ctx>(
  hook: ((ctx: Ctx) => void | Promise<void>) | undefined,
  ctx: Ctx,
): Promise<void> {
  if (!hook) return
  await hook(ctx)
}

/**
 * Run a `did*` hook. Fire-and-forget: a throwing plugin logs a
 * warning but does not break the viewer.
 */
export function runDidHook<Ctx>(
  hook: ((ctx: Ctx) => void | Promise<void>) | undefined,
  ctx: Ctx,
  label: string,
): void {
  if (!hook) return
  try {
    const result = hook(ctx)
    if (result && typeof (result as Promise<void>).catch === "function") {
      ;(result as Promise<void>).catch((err) => {
        console.warn(`pencere: ${label} hook threw`, err)
      })
    }
  } catch (err) {
    console.warn(`pencere: ${label} hook threw`, err)
  }
}
