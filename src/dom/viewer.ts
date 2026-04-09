import { Pencere } from "../core"
import { createTranslator } from "../i18n"
import type { PencereStrings, Translator } from "../i18n"
import type { CloseReason, ImageItem, Item, PencereOptions } from "../types"
import { DialogController } from "./dialog"
import type { DialogControllerOptions } from "./dialog"
import { GestureEngine } from "./gesture"
import { computeAspectRatio, loadImage } from "./image-loader"
import type { ImageLoaderOptions } from "./image-loader"
import { resolveKeyAction } from "./keyboard"
import type { KeyboardMapOptions } from "./keyboard"
import { LiveRegion } from "./live-region"
import { prefersReducedMotion } from "./media-query"
import { runMomentum } from "./momentum"
import { injectStyles } from "./styles"
import { SwipeNavigator } from "./swipe-nav"
import { IDENTITY, toCss } from "./transform"

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
  private readonly cleanup = new AbortController()
  private readonly onKeyDown: (e: KeyboardEvent) => void

  constructor(options: PencereViewerOptions<T>) {
    this.opts = options
    this.core = new Pencere(options)
    this.t = options.i18n ?? createTranslator(options.strings)

    const container = options.container ?? document.body
    const doc = container.ownerDocument
    injectStyles(doc, options.nonce)

    // Prefer the native <dialog> element for top-layer, inertness, ESC.
    const root = doc.createElement("dialog")
    root.classList.add("pc-root")
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
    root.append(stage)
    root.setAttribute("aria-describedby", caption.id)

    this.root = root
    this.stage = stage
    this.slot = slot
    this.caption = caption
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

    this.core.events.on("open", () => void this.renderSlide())
    this.core.events.on("change", () => void this.renderSlide())
    this.core.events.on("close", () => {
      this.dialog.hide()
      this.root.classList.remove("pc-root--open")
      this.gesture.detach()
      this.gesture.reset()
    })
  }

  async open(index?: number): Promise<void> {
    await this.core.open(index)
    this.root.classList.add("pc-root--open")
    this.dialog.show()
    this.gesture.attach()
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
    // Disable prev/next at ends when loop is off.
    const loop = this.opts.loop ?? true
    this.prevButton.disabled = !loop && this.core.state.index === 0
    this.nextButton.disabled = !loop && this.core.state.index === total - 1

    if (item.type !== "image") {
      // Non-image slide types are handled via future renderer plugins.
      this.slot.textContent = ""
      return
    }
    const imageItem = item as ImageItem
    this.slot.style.setProperty("--pc-slot-ar", computeAspectRatio(imageItem))

    try {
      const { element } = await loadImage(imageItem, this.loadAbort.signal, this.opts.image)
      if (this.loadAbort.signal.aborted) return
      element.classList.add("pc-img")
      this.slot.textContent = ""
      this.slot.appendChild(element)
      this.currentImg = element
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
    const result = this.swipe.release(W, H)
    this.resetSwipeVisual()

    switch (result.action) {
      case "next":
        void this.core.next()
        break
      case "prev":
        void this.core.prev()
        break
      case "dismiss":
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

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.core.state.isOpen) return
    const action = resolveKeyAction(e, this.opts.keyboard)
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
}
