import { Pencere } from "../core"
import { createTranslator } from "../i18n"
import type { PencereStrings, Translator } from "../i18n"
import type { CloseReason, ImageItem, Item, PencereOptions } from "../types"
import { DialogController } from "./dialog"
import type { DialogControllerOptions } from "./dialog"
import { GestureEngine } from "./gesture"
import { Haptics } from "./haptics"
import type { HapticsOptions } from "./haptics"
import { computeAspectRatio, loadImage } from "./image-loader"
import type { ImageLoaderOptions } from "./image-loader"
import { resolveKeyAction } from "./keyboard"
import type { KeyboardMapOptions } from "./keyboard"
import { LiveRegion } from "./live-region"
import { prefersReducedMotion } from "./media-query"
import { runMomentum } from "./momentum"
import { pickRenderer } from "./renderers"
import type { Renderer } from "./renderers"
import { injectStyles } from "./styles"
import { SwipeNavigator } from "./swipe-nav"
import { IDENTITY, toCss } from "./transform"

/**
 * Approximate pixel height of the top and bottom gradient toolbar
 * bands. Kept as a constant rather than measured each focus-in so
 * the focus guard does not trigger layout thrash. Matches the
 * `.pc-toolbar-top / .pc-toolbar-bottom` paddings in styles.ts.
 */
const TOOLBAR_BAND_PX = 80

export interface PencereViewerOptions<T extends Item = Item>
  extends PencereOptions<T>, Pick<DialogControllerOptions, "useNativeDialog" | "lockScroll"> {
  /** Container to attach the viewer root into. Defaults to document.body. */
  container?: HTMLElement
  /** Translator overrides — either a string bundle or a custom function. */
  strings?: Partial<PencereStrings>
  i18n?: Translator
  /** Keyboard remapping / disabling. */
  keyboard?: KeyboardMapOptions
  /** Image loading options (CORS, referrer policy, etc). */
  image?: ImageLoaderOptions
  /**
   * Force reduced-motion behavior regardless of the user's OS setting.
   * `"auto"` (default) honors `prefers-reduced-motion`.
   */
  reducedMotion?: "auto" | "always" | "never"
  /**
   * CSP nonce. When set, the stylesheet fallback `<style>` element
   * receives `nonce="…"` so it satisfies `style-src 'nonce-…'`. When
   * constructable stylesheets are available (modern browsers), the
   * nonce is irrelevant because no inline style element is created.
   */
  nonce?: string
  /**
   * Writing direction. `"auto"` (default) inherits from the host
   * document's `<html dir>` / computed direction. Explicit `"ltr"` or
   * `"rtl"` forces the viewer independently of the page. In `"rtl"`,
   * arrow keys and horizontal swipes flip so that "next" always means
   * "toward the end of the reading flow".
   */
  dir?: "ltr" | "rtl" | "auto"
  /**
   * Opt in to haptic feedback on touch devices. `true` enables the
   * default pattern set; an object lets you override individual
   * durations. Never triggers on coarse-less pointers (desktop) and
   * is a no-op on iOS Safari which does not expose the Vibration API.
   * See #46 / WCAG: haptics pair with `prefers-reduced-motion`, so
   * consumers who force `reducedMotion: "always"` should set
   * `haptics: false` as well.
   */
  haptics?: boolean | HapticsOptions
  /**
   * Hash-based deep linking (#75). When `true`, the viewer writes
   * `#p{n+1}` into the URL on open, updates it on every slide
   * change, and closes on `popstate` so the browser Back button
   * (and Safari / Firefox edge-swipe back gestures) dismiss the
   * viewer naturally. Pass an object to customize the pattern.
   */
  routing?: boolean | RoutingOptions
  /**
   * Fullscreen API (#14). When `true`, expose `enterFullscreen()` /
   * `exitFullscreen()` / `toggleFullscreen()` and fall back to a CSS
   * faux-fullscreen class on iOS Safari (which only grants real
   * fullscreen to `<video>`). Defaults to `false`.
   */
  fullscreen?: boolean
  /**
   * View Transitions API (#12). When `true` and the host browser
   * exposes `document.startViewTransition`, `open(index, trigger)`
   * wraps the open in a view transition and assigns a shared
   * `view-transition-name` to the trigger thumbnail and the
   * lightbox image, so the UA morphs between them. Gracefully
   * degrades to an instant open on unsupporting engines.
   */
  viewTransition?: boolean
  /**
   * Custom renderer registry (#8). Each entry claims a subset of
   * item types and mounts them into the viewer slot. User renderers
   * are consulted before the built-ins, so you can override the
   * defaults for video / iframe / html. The image renderer is
   * hard-wired in the viewer and cannot be replaced.
   */
  renderers?: Renderer[]
}

/** See `PencereViewerOptions.routing`. */
export interface RoutingOptions {
  /** Build the fragment for a given slide index. Default: `#p{n+1}`. */
  pattern?: (index: number) => string
  /**
   * Parse the current `location.hash` into a slide index, or return
   * `null` when the URL does not identify a slide. Default matches
   * the default pattern.
   */
  parse?: (hash: string) => number | null
}

/**
 * A high-level viewer that composes Pencere core, DialogController,
 * GestureEngine, LiveRegion, and loadImage into a working lightbox.
 *
 * Visual styling lives in a single stylesheet injected by `styles.ts`.
 * Runtime values (transform, opacity, aspect ratio) are written as CSS
 * custom properties via `setProperty`, which keeps the viewer fully
 * compatible with strict CSP (`style-src 'nonce-…'`, no `unsafe-inline`).
 */
export class PencereViewer<T extends Item = Item> {
  readonly core: Pencere<T>
  readonly root: HTMLDialogElement
  private readonly stage: HTMLElement
  private readonly slot: HTMLElement
  private readonly caption: HTMLElement
  private readonly longDescription: HTMLElement
  private readonly counter: HTMLElement
  private readonly closeButton: HTMLButtonElement
  private readonly prevButton: HTMLButtonElement
  private readonly nextButton: HTMLButtonElement
  private readonly liveRegion: LiveRegion
  private readonly dialog: DialogController
  private readonly gesture: GestureEngine
  private readonly swipe = new SwipeNavigator()
  private swipeActivePointer: number | null = null
  private momentumCancel: (() => void) | null = null
  private readonly reducedMotion: ReturnType<typeof prefersReducedMotion>
  private readonly t: Translator
  private readonly opts: PencereViewerOptions<T>
  private loadAbort: AbortController | null = null
  private currentImg: HTMLImageElement | null = null
  private renderPromise: Promise<void> | null = null
  private currentRendererEl: {
    renderer: Renderer
    el: HTMLElement
    item: Item
  } | null = null
  private readonly cleanup = new AbortController()
  private readonly onKeyDown: (e: KeyboardEvent) => void
  private direction: "ltr" | "rtl"
  private readonly haptics: Haptics
  private readonly routing: {
    pattern: (i: number) => string
    parse: (h: string) => number | null
  } | null
  private routedOpen = false

  constructor(options: PencereViewerOptions<T>) {
    this.opts = options
    this.core = new Pencere(options)
    this.t = options.i18n ?? createTranslator(options.strings)

    const container = options.container ?? document.body
    const doc = container.ownerDocument
    injectStyles(doc, options.nonce)

    // Resolve writing direction. `auto` (default) walks up from the
    // container to find an explicit `dir` attribute and falls back to
    // the computed direction of <html>. Explicit `ltr` / `rtl` wins.
    this.direction = resolveDirection(options.dir, container)
    this.haptics = new Haptics(
      typeof options.haptics === "boolean" ? { enabled: options.haptics } : (options.haptics ?? {}),
    )
    this.routing = resolveRouting(options.routing)

    // Prefer the native <dialog> element for top-layer, inertness, ESC.
    const root = doc.createElement("dialog")
    root.classList.add("pc-root")
    root.setAttribute("dir", this.direction)
    root.setAttribute("aria-label", this.t("dialogLabel"))
    root.setAttribute("aria-roledescription", "carousel")

    const stage = doc.createElement("div")
    stage.classList.add("pc-stage")
    stage.setAttribute("role", "group")
    stage.setAttribute("aria-roledescription", "slide")

    const slot = doc.createElement("div")
    slot.classList.add("pc-slot")

    const caption = doc.createElement("figcaption")
    caption.classList.add("pc-caption")
    caption.id = `pencere-caption-${Math.random().toString(36).slice(2, 10)}`

    // Visually-hidden long description, announced by screen readers
    // alongside the visible caption when the consumer provides
    // `item.longDescription`. Mounts inside the root so the
    // aria-describedby reference is never dangling.
    const longDescription = doc.createElement("div")
    longDescription.classList.add("pc-longdesc", "pc-live")
    longDescription.id = `pencere-longdesc-${Math.random().toString(36).slice(2, 10)}`

    const counter = doc.createElement("div")
    counter.classList.add("pc-counter")

    const topBar = doc.createElement("div")
    topBar.classList.add("pc-toolbar-top")
    topBar.setAttribute("data-pc-part", "toolbar-top")

    const bottomBar = doc.createElement("div")
    bottomBar.classList.add("pc-toolbar-bottom")
    bottomBar.setAttribute("data-pc-part", "toolbar-bottom")

    const closeButton = this.makeButton(doc, "close", "×", ["pc-btn--close"])
    const prevButton = this.makeButton(doc, "previous", "‹", ["pc-btn--nav", "pc-btn--prev"])
    const nextButton = this.makeButton(doc, "next", "›", ["pc-btn--nav", "pc-btn--next"])

    topBar.append(closeButton, counter)
    bottomBar.append(caption)
    stage.append(slot, prevButton, nextButton, topBar, bottomBar)
    root.append(stage, longDescription)
    root.setAttribute("aria-describedby", `${caption.id} ${longDescription.id}`)

    this.root = root
    this.stage = stage
    this.slot = slot
    this.caption = caption
    this.longDescription = longDescription
    this.counter = counter
    this.closeButton = closeButton
    this.prevButton = prevButton
    this.nextButton = nextButton
    this.liveRegion = new LiveRegion(root)
    this.dialog = new DialogController(root, {
      label: this.t("dialogLabel"),
      useNativeDialog: options.useNativeDialog,
      lockScroll: options.lockScroll,
      onDismiss: (reason) => {
        void this.close(reason)
      },
    })
    this.gesture = new GestureEngine(stage, {
      onUpdate: (snapshot) => {
        if (snapshot.type === "tap" && !this.stage.matches(":hover")) return
        if (snapshot.type === "doubleTap") {
          this.handleDoubleTap()
          return
        }
        // `will-change: transform` is promoted to a compositor layer by
        // the browser but keeps that layer alive indefinitely, which
        // is wasted memory outside of an active gesture. Promote on
        // start, demote on end. #34.
        if (snapshot.type === "start" && this.currentImg) {
          this.currentImg.style.setProperty("will-change", "transform")
        } else if (snapshot.type === "end" && this.currentImg) {
          this.currentImg.style.removeProperty("will-change")
        }
        // While a scale=1 swipe is in flight, the swipe controller owns
        // the visual transform — don't let gesture pan overwrite it.
        if (this.swipe.isActive) return
        this.writeImgTransform(snapshot.transform)
      },
    })
    this.reducedMotion = prefersReducedMotion()

    container.appendChild(root)

    // Wire DOM events. Every listener is tied to `cleanup.signal` so
    // destroy() can rip them all out at once.
    const sig = this.cleanup.signal
    closeButton.addEventListener("click", () => void this.close("user"), { signal: sig })
    prevButton.addEventListener("click", () => void this.core.prev(), { signal: sig })
    nextButton.addEventListener("click", () => void this.core.next(), { signal: sig })
    this.onKeyDown = (e: KeyboardEvent): void => this.handleKeyDown(e)
    doc.addEventListener("keydown", this.onKeyDown, { signal: sig })

    // Swipe navigation + drag-to-dismiss listeners. Registered in capture
    // phase so they run before GestureEngine's bubble listeners and can
    // short-circuit pan application while at scale=1.
    stage.addEventListener("pointerdown", (e) => this.onSwipeDown(e), {
      signal: sig,
      capture: true,
    })
    stage.addEventListener("pointermove", (e) => this.onSwipeMove(e), {
      signal: sig,
      capture: true,
    })
    stage.addEventListener("pointerup", (e) => this.onSwipeUp(e), { signal: sig, capture: true })
    stage.addEventListener("pointercancel", (e) => this.onSwipeCancel(e), {
      signal: sig,
      capture: true,
    })
    stage.addEventListener("wheel", (e) => this.onWheelZoom(e), { signal: sig, passive: false })

    // WCAG 2.4.11 Focus Not Obscured (Minimum) — when focus moves to
    // an element that happens to sit under one of the gradient toolbar
    // bands, nudge it into view. pencere's own buttons live inside
    // the toolbars themselves so they are never occluded, but consumer
    // content (rich captions with links, future video controls, the
    // eventual thumbnail strip) has to be handled too.
    root.addEventListener("focusin", (e) => this.onFocusIn(e), { signal: sig })

    this.core.events.on("open", () => {
      this.renderPromise = this.renderSlide()
    })
    this.core.events.on("change", () => {
      this.renderPromise = this.renderSlide()
      this.syncRoutingFragment("replace")
    })
    this.core.events.on("close", () => {
      this.dialog.hide()
      this.root.classList.remove("pc-root--open")
      this.gesture.detach()
      this.gesture.reset()
      // Unwind the routing entry only when the close came from inside
      // pencere — popstate-driven closes must NOT call back() again
      // or the user's real history would be stepped twice.
      if (this.routedOpen && !this.suppressRoutingPop) {
        this.routedOpen = false
        try {
          window.history.back()
        } catch {
          /* ignore */
        }
      }
      this.suppressRoutingPop = false
    })

    if (this.routing) {
      const onPopState = (): void => {
        if (!this.core.state.isOpen) return
        this.suppressRoutingPop = true
        void this.close("user")
      }
      window.addEventListener("popstate", onPopState, { signal: sig })
    }
  }

  private suppressRoutingPop = false

  async open(index?: number, trigger?: HTMLElement): Promise<void> {
    // Re-resolve direction on every open so consumers that toggle
    // `<html dir>` at runtime (docs pages, i18n switchers) pick up
    // the change without having to destroy + recreate the viewer.
    // Explicit `dir: "ltr"|"rtl"` still wins because resolveDirection
    // short-circuits when the option is set.
    const container = this.opts.container ?? this.root.ownerDocument.body
    this.direction = resolveDirection(this.opts.dir, container)
    this.root.setAttribute("dir", this.direction)

    // View Transitions API morph (#12). When opted in and supported,
    // tag the trigger thumbnail with a shared `view-transition-name`
    // and wrap the core open in `document.startViewTransition` so
    // the browser animates the thumbnail → lightbox image transform.
    // The callback awaits both core.open AND the slide's async render
    // pipeline (renderPromise) so the browser's "new state" snapshot
    // is taken after the <img> has actually decoded and landed in
    // the slot — otherwise the UA snapshots an empty dialog and the
    // thumbnail just fades to nothing.
    const run = async (): Promise<void> => {
      await this.core.open(index)
      this.root.classList.add("pc-root--open")
      this.dialog.show()
      this.gesture.attach()
      this.syncRoutingFragment("push")
      if (this.renderPromise) await this.renderPromise
    }
    const doc = this.root.ownerDocument as Document & {
      startViewTransition?: (cb: () => unknown | Promise<unknown>) => {
        finished: Promise<void>
        updateCallbackDone: Promise<void>
      }
    }
    if (this.opts.viewTransition === true && typeof doc.startViewTransition === "function") {
      if (trigger) {
        trigger.style.setProperty("view-transition-name", "pencere-hero")
      }
      const vt = doc.startViewTransition(async () => {
        await run()
      })
      try {
        // Wait for the DOM callback to commit first, then the
        // animation itself. Clearing the trigger's
        // view-transition-name during `updateCallbackDone` means the
        // old node stops competing with the lightbox image for the
        // name before the UA starts animating.
        await vt.updateCallbackDone
        if (trigger) trigger.style.removeProperty("view-transition-name")
        await vt.finished
      } catch {
        /* ignore aborted transition */
        if (trigger) trigger.style.removeProperty("view-transition-name")
      }
      return
    }
    await run()
  }

  /**
   * Look at the current `location.hash`, and if it identifies a
   * valid slide via the configured `routing.parse`, open the
   * matching index. No-op when routing is off or the URL does not
   * match. Returns `true` iff the viewer was actually opened.
   */
  async openFromLocation(): Promise<boolean> {
    if (!this.routing) return false
    const hash = typeof location !== "undefined" ? location.hash : ""
    const idx = this.routing.parse(hash)
    if (idx === null || idx < 0 || idx >= this.core.state.items.length) return false
    await this.open(idx)
    return true
  }

  private syncRoutingFragment(mode: "push" | "replace"): void {
    if (!this.routing) return
    if (typeof window === "undefined") return
    const next = this.routing.pattern(this.core.state.index)
    const url = location.pathname + location.search + next
    try {
      if (mode === "push" && !this.routedOpen) {
        window.history.pushState({ pencere: true, i: this.core.state.index }, "", url)
        this.routedOpen = true
      } else {
        window.history.replaceState({ pencere: true, i: this.core.state.index }, "", url)
      }
    } catch {
      // Some sandboxed contexts throw on history mutation; ignore.
    }
  }

  async close(reason: CloseReason = "api"): Promise<void> {
    await this.core.close(reason)
  }

  destroy(): void {
    this.cleanup.abort()
    this.momentumCancel?.()
    this.loadAbort?.abort()
    this.gesture.detach()
    this.dialog.destroy()
    this.liveRegion.destroy()
    this.reducedMotion.dispose()
    this.core.destroy()
    this.root.remove()
  }

  private makeButton(
    doc: Document,
    key: keyof PencereStrings,
    label: string,
    extraClasses: string[] = [],
  ): HTMLButtonElement {
    const b = doc.createElement("button")
    b.type = "button"
    b.setAttribute("aria-label", this.t(key))
    b.classList.add("pc-btn", ...extraClasses)
    // textContent keeps the visible glyph safe from XSS.
    b.textContent = label
    return b
  }

  private writeImgTransform(t: { x: number; y: number; scale: number }): void {
    if (!this.currentImg) return
    this.currentImg.style.setProperty("--pc-img-transform", toCss(t))
  }

  private writeImgTransformRaw(css: string): void {
    if (!this.currentImg) return
    this.currentImg.style.setProperty("--pc-img-transform", css)
  }

  private async renderSlide(): Promise<void> {
    const item = this.core.item
    this.loadAbort?.abort()
    this.loadAbort = new AbortController()
    // Tear down the previous renderer-backed slide (video / iframe
    // / custom) so autoplay videos pause, iframe src unloads, etc.
    if (this.currentRendererEl) {
      const { renderer, el, item: previous } = this.currentRendererEl
      try {
        renderer.unmount?.(el, previous as never)
      } catch {
        /* ignore renderer teardown errors */
      }
      this.currentRendererEl = null
    }
    // Reset gesture transform between slides.
    this.gesture.reset()
    // Update counter + live region unconditionally.
    const total = this.core.state.items.length
    const index = this.core.state.index + 1
    this.counter.textContent = this.t("counter", { index, total })
    this.liveRegion.announce(
      `${this.t("counter", { index, total })}${item.alt ? `: ${item.alt}` : ""}`,
    )
    // Captions are textContent by default (issue #48).
    this.caption.textContent =
      "caption" in item && typeof item.caption === "string" ? item.caption : ""
    // Propagate `lang` so AT switches voices + CJK / Arabic font
    // stacks kick in via the `--pc-font-*` custom properties (#65).
    const lang = "lang" in item ? (item as { lang?: string }).lang : undefined
    if (lang) {
      this.caption.setAttribute("lang", lang)
      this.longDescription.setAttribute("lang", lang)
    } else {
      this.caption.removeAttribute("lang")
      this.longDescription.removeAttribute("lang")
    }
    // Long description lives in a visually hidden, aria-described-by
    // node so AT users get the full descriptor without crowding the
    // visible caption line (#26).
    this.longDescription.textContent =
      "longDescription" in item &&
      typeof (item as { longDescription?: string }).longDescription === "string"
        ? (item as { longDescription: string }).longDescription
        : ""
    // Disable prev/next at ends when loop is off.
    const loop = this.opts.loop ?? true
    this.prevButton.disabled = !loop && this.core.state.index === 0
    this.nextButton.disabled = !loop && this.core.state.index === total - 1

    if (item.type !== "image") {
      // Non-image slide types flow through the renderer registry
      // (#8). User-supplied renderers run first; built-in video /
      // iframe / html renderers ship as fallbacks.
      this.slot.textContent = ""
      const renderer = pickRenderer(item, this.opts.renderers)
      if (!renderer) {
        this.slot.textContent = `pencere: no renderer for item type "${item.type}"`
        return
      }
      try {
        const mounted = await renderer.mount(item, {
          document: this.root.ownerDocument,
          signal: this.loadAbort.signal,
        })
        if (this.loadAbort.signal.aborted) {
          renderer.unmount?.(mounted, item as never)
          return
        }
        this.slot.appendChild(mounted)
        // Store the current renderer + mount for teardown on the
        // next slide change or close.
        this.currentRendererEl = { renderer, el: mounted, item }
        this.currentImg = null
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          this.slot.textContent = `pencere: renderer failed (${(err as Error).message})`
        }
      }
      return
    }
    const imageItem = item as ImageItem
    this.slot.style.setProperty("--pc-slot-ar", computeAspectRatio(imageItem))
    // ThumbHash / BlurHash style placeholder (#29). Paint the
    // consumer-supplied low-res hint under the slot so the user
    // sees a chromatic silhouette instantly instead of an empty
    // void while the full-res image decodes.
    if (imageItem.placeholder) {
      this.slot.style.setProperty("--pc-slot-placeholder", imageItem.placeholder)
      this.slot.classList.add("pc-slot--placeholder")
    } else {
      this.slot.style.removeProperty("--pc-slot-placeholder")
      this.slot.classList.remove("pc-slot--placeholder")
    }

    try {
      const { element, image } = await loadImage(imageItem, this.loadAbort.signal, this.opts.image)
      if (this.loadAbort.signal.aborted) return
      // The transform target is always the <img>, even when the
      // loader wrapped it in a <picture> for AVIF/WebP fallback.
      image.classList.add("pc-img")
      if (this.opts.viewTransition === true) {
        image.style.setProperty("view-transition-name", "pencere-hero")
      }
      this.slot.textContent = ""
      this.slot.appendChild(element)
      // Drop the placeholder once the decoded image is in the slot
      // (#29). A small rAF gives the browser a frame to commit the
      // image layer before we fade the hint out.
      requestAnimationFrame(() => {
        this.slot.classList.remove("pc-slot--placeholder")
      })
      this.currentImg = image
      this.writeImgTransform(this.gesture.current)
      this.core.events.emit("slideLoad", { index: this.core.state.index, item })
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      this.slot.textContent = "Image failed to load"
    }
  }

  private handleDoubleTap(): void {
    if (!this.currentImg) return
    // With transform-origin:center, a pure scale already pins center.
    const current = this.gesture.current
    const next = current.scale > 1 ? IDENTITY : { x: 0, y: 0, scale: 2 }
    this.gesture.setTransform(next)
    this.writeImgTransform(this.gesture.current)
    this.haptics.fire("doubleTap")
  }

  private onWheelZoom(e: WheelEvent): void {
    if (!this.currentImg) return
    e.preventDefault()
    // Exponential feel: each 300px of wheel delta ≈ e.
    const factor = Math.exp(-e.deltaY / 300)
    const current = this.gesture.current
    const newScale = Math.max(1, Math.min(8, current.scale * factor))
    const k = newScale / current.scale
    // With transform-origin:center, we compute the vector from the
    // image visual center to the cursor and adjust translation so the
    // point under the cursor stays fixed.
    const rect = this.currentImg.getBoundingClientRect()
    const imgCx = rect.left + rect.width / 2
    const imgCy = rect.top + rect.height / 2
    const offsetX = e.clientX - imgCx
    const offsetY = e.clientY - imgCy
    const next = {
      x: current.x + offsetX * (1 - k),
      y: current.y + offsetY * (1 - k),
      scale: newScale,
    }
    // Snap-back fully to identity when zooming below 1.
    const snapped = next.scale <= 1 ? IDENTITY : next
    if (snapped === IDENTITY && current.scale > 1) this.haptics.fire("snap")
    this.gesture.setTransform(snapped)
    this.writeImgTransform(this.gesture.current)
  }

  private isSwipeEligible(): boolean {
    return this.gesture.current.scale === 1
  }

  private onSwipeDown(e: PointerEvent): void {
    if (!this.isSwipeEligible()) return
    if (this.swipeActivePointer !== null) return
    // Don't start a swipe when the user taps an interactive control.
    const target = e.target as Element | null
    if (target?.closest("button, a, [data-pc-no-gesture]")) return
    this.swipeActivePointer = e.pointerId
    this.momentumCancel?.()
    this.momentumCancel = null
    this.swipe.begin(e.clientX, e.clientY, e.timeStamp || performance.now())
  }

  private onSwipeMove(e: PointerEvent): void {
    if (this.swipeActivePointer !== e.pointerId) return
    if (!this.isSwipeEligible()) {
      this.swipe.cancel()
      this.swipeActivePointer = null
      this.resetSwipeVisual()
      return
    }
    const { dx, dy, axis } = this.swipe.move(e.clientX, e.clientY, e.timeStamp || performance.now())
    if (!axis || !this.currentImg) return
    // Horizontal: translate follows finger 1:1; vertical: translate + fade.
    if (axis === "horizontal") {
      this.writeImgTransformRaw(`translate3d(${dx.toFixed(1)}px, 0, 0)`)
      this.root.style.setProperty("--pc-root-opacity", "1")
    } else {
      this.writeImgTransformRaw(`translate3d(0, ${dy.toFixed(1)}px, 0)`)
      const rect = this.stage.getBoundingClientRect()
      const h = rect.height || 1
      const fade = Math.max(0.3, 1 - Math.abs(dy) / h)
      this.root.style.setProperty("--pc-root-opacity", String(fade))
    }
  }

  private onSwipeUp(e: PointerEvent): void {
    if (this.swipeActivePointer !== e.pointerId) return
    this.swipeActivePointer = null
    const rect = this.stage.getBoundingClientRect()
    const W = rect.width || this.root.clientWidth || 0
    const H = rect.height || this.root.clientHeight || 0
    const result = this.swipe.release(W, H, this.direction)
    this.resetSwipeVisual()

    switch (result.action) {
      case "next":
        void this.core.next()
        break
      case "prev":
        void this.core.prev()
        break
      case "dismiss":
        this.haptics.fire("dismiss")
        void this.close("user")
        break
      case "cancel": {
        // Run a short momentum spring back to origin.
        if (!this.currentImg) return
        let x = result.dx
        let y = result.dy
        this.momentumCancel = runMomentum(
          -x * 0.2,
          -y * 0.2,
          (vx, vy) => {
            x += vx
            y += vy
            if (Math.hypot(x, y) < 0.5) {
              this.writeImgTransformRaw("translate3d(0,0,0)")
              return false
            }
            this.writeImgTransformRaw(`translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`)
          },
          { friction: 0.82 },
        )
        break
      }
    }
  }

  private onSwipeCancel(e: PointerEvent): void {
    if (this.swipeActivePointer !== e.pointerId) return
    this.swipeActivePointer = null
    this.swipe.cancel()
    this.resetSwipeVisual()
  }

  private resetSwipeVisual(): void {
    this.root.style.removeProperty("--pc-root-opacity")
  }

  /**
   * WCAG 2.4.11 — make sure a freshly focused element is not hidden
   * underneath the top or bottom toolbar band. We short-circuit for
   * elements that live inside the toolbars themselves (their focus
   * ring is always painted above the gradient since outlines are not
   * clipped by their parent's background).
   */
  private onFocusIn(e: FocusEvent): void {
    const target = e.target as Element | null
    if (!target || !(target instanceof HTMLElement)) return
    // Controls that live inside either toolbar are safe by construction.
    if (target.closest("[data-pc-part='toolbar-top']")) return
    if (target.closest("[data-pc-part='toolbar-bottom']")) return

    const rootRect = this.root.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const topBand = rootRect.top + TOOLBAR_BAND_PX
    const bottomBand = rootRect.bottom - TOOLBAR_BAND_PX

    const obscuredTop = targetRect.top < topBand && targetRect.bottom > rootRect.top
    const obscuredBottom = targetRect.bottom > bottomBand && targetRect.top < rootRect.bottom

    if (!obscuredTop && !obscuredBottom) return

    // `scrollIntoView({ block: "nearest" })` with scroll-margin hooks
    // on .pc-btn (see styles.ts) lets the browser reveal the element
    // without any layout math. If the ancestor chain has no scrollable
    // box this is a cheap no-op, which is exactly what we want for
    // the default image slot.
    try {
      target.scrollIntoView({ block: "nearest", inline: "nearest" })
    } catch {
      // Some jsdom versions throw on scrollIntoView; WCAG is a
      // browser runtime concern so swallowing here is fine.
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.core.state.isOpen) return

    // WCAG 2.5.7 dragging alternative. While zoomed in, the arrow keys
    // pan the image instead of navigating slides or triggering the
    // default carousel mapping — this gives keyboard-only users the
    // same reach as a one-finger pan gesture. ArrowUp / ArrowDown are
    // otherwise unused by pencere, so we intercept them here before
    // `resolveKeyAction` gets a chance.
    const zoomed = this.gesture.current.scale > 1
    if (zoomed && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const step = 48
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        this.panBy(step, 0)
        return
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        this.panBy(-step, 0)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        this.panBy(0, step)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        this.panBy(0, -step)
        return
      }
    }

    const action = resolveKeyAction(e, { ...this.opts.keyboard, direction: this.direction })
    if (!action) return

    // Route to core.
    e.preventDefault()
    switch (action) {
      case "close":
        void this.close("escape")
        break
      case "next":
        void this.core.next()
        break
      case "prev":
        void this.core.prev()
        break
      case "first":
        void this.core.goTo(0)
        break
      case "last":
        void this.core.goTo(this.core.state.items.length - 1)
        break
      case "zoomIn":
        this.zoomBy(1.25)
        break
      case "zoomOut":
        this.zoomBy(1 / 1.25)
        break
      case "zoomReset":
        this.zoomReset()
        break
      default:
        break
    }
  }

  /**
   * Shift the pan translation by a pixel vector. Used by the keyboard
   * pan alternative (#25 / WCAG 2.5.7) so users who cannot drag can
   * still reach every corner of a zoomed image.
   */
  private panBy(dx: number, dy: number): void {
    if (!this.currentImg) return
    const current = this.gesture.current
    if (current.scale <= 1) return
    this.gesture.setTransform({
      x: current.x + dx,
      y: current.y + dy,
      scale: current.scale,
    })
    this.writeImgTransform(this.gesture.current)
  }

  /** Zoom by a multiplicative factor around the image center. */
  private zoomBy(factor: number): void {
    if (!this.currentImg) return
    const current = this.gesture.current
    const newScale = Math.max(1, Math.min(8, current.scale * factor))
    if (newScale === current.scale) return
    const k = newScale / current.scale
    const next = {
      x: current.x * k,
      y: current.y * k,
      scale: newScale,
    }
    const snapped = next.scale <= 1 ? IDENTITY : next
    this.gesture.setTransform(snapped)
    this.writeImgTransform(this.gesture.current)
  }

  private zoomReset(): void {
    if (!this.currentImg) return
    this.gesture.setTransform(IDENTITY)
    this.writeImgTransform(IDENTITY)
  }

  /** For tests: is the user in reduced-motion mode? */
  get isReducedMotion(): boolean {
    if (this.opts.reducedMotion === "always") return true
    if (this.opts.reducedMotion === "never") return false
    return this.reducedMotion.matches
  }

  /** For tests + integrations: resolved writing direction. */
  get dir(): "ltr" | "rtl" {
    return this.direction
  }

  /**
   * Request real fullscreen on the viewer root. Falls back to a
   * `pc-root--faux-fullscreen` CSS class on iOS Safari (which only
   * grants Fullscreen API to `<video>`). No-op when
   * `options.fullscreen` is not enabled.
   */
  async enterFullscreen(): Promise<void> {
    if (this.opts.fullscreen !== true) return
    const el = this.root as HTMLElement & {
      requestFullscreen?: () => Promise<void>
      webkitRequestFullscreen?: () => void
    }
    if (typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen()
        return
      } catch {
        // Fall through to faux-fullscreen.
      }
    } else if (typeof el.webkitRequestFullscreen === "function") {
      try {
        el.webkitRequestFullscreen()
        return
      } catch {
        /* ignore */
      }
    }
    // iOS Safari / restricted environment — CSS faux-fullscreen. The
    // class is styled in styles.ts to pin the root to the visual
    // viewport with `position: fixed; inset: 0` (which .pc-root
    // already is), plus a higher z-index to punch over any page chrome.
    this.root.classList.add("pc-root--faux-fullscreen")
  }

  /** Exit fullscreen (real or faux). */
  async exitFullscreen(): Promise<void> {
    const doc = this.root.ownerDocument as Document & {
      webkitExitFullscreen?: () => void
    }
    if (doc.fullscreenElement === this.root) {
      try {
        await doc.exitFullscreen()
      } catch {
        /* ignore */
      }
    } else if (typeof doc.webkitExitFullscreen === "function") {
      try {
        doc.webkitExitFullscreen()
      } catch {
        /* ignore */
      }
    }
    this.root.classList.remove("pc-root--faux-fullscreen")
  }

  /** Toggle between windowed and fullscreen. */
  async toggleFullscreen(): Promise<void> {
    const active =
      this.root.ownerDocument.fullscreenElement === this.root ||
      this.root.classList.contains("pc-root--faux-fullscreen")
    if (active) await this.exitFullscreen()
    else await this.enterFullscreen()
  }
}

/**
 * Resolve the viewer's effective writing direction.
 *
 * Explicit `ltr`/`rtl` always win. `auto` (or `undefined`) walks up
 * from the container looking for a `dir` attribute and, failing that,
 * reads the computed direction of the host document's root element.
 * This keeps the viewer honest with whatever the surrounding app has
 * configured — including mixed LTR docs with an `<article dir="rtl">`.
 */
/**
 * Normalize the `routing` option into a concrete pattern/parse pair,
 * or `null` when routing is disabled.
 */
function resolveRouting(
  option: boolean | RoutingOptions | undefined,
): { pattern: (i: number) => string; parse: (h: string) => number | null } | null {
  if (!option) return null
  const o = option === true ? {} : option
  const pattern = o.pattern ?? ((i: number) => `#p${i + 1}`)
  const parse =
    o.parse ??
    ((hash: string): number | null => {
      const m = /^#p(\d+)$/.exec(hash)
      if (!m) return null
      const n = Number.parseInt(m[1]!, 10)
      return Number.isFinite(n) && n >= 1 ? n - 1 : null
    })
  return { pattern, parse }
}

function resolveDirection(
  explicit: "ltr" | "rtl" | "auto" | undefined,
  container: HTMLElement,
): "ltr" | "rtl" {
  if (explicit === "ltr" || explicit === "rtl") return explicit
  let node: Element | null = container
  while (node) {
    const d = node.getAttribute("dir")
    if (d === "ltr" || d === "rtl") return d
    node = node.parentElement
  }
  const doc = container.ownerDocument
  const view = doc.defaultView
  if (view) {
    const computed = view.getComputedStyle(doc.documentElement).direction
    if (computed === "rtl") return "rtl"
  }
  return "ltr"
}
