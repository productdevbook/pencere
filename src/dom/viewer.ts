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
import { toCss } from "./transform"

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
}

const ROOT_STYLE = [
  "position:fixed",
  "inset:0",
  "z-index:99999",
  "display:flex",
  "flex-direction:column",
  "align-items:center",
  "justify-content:center",
  "background:var(--pc-bg, rgba(0,0,0,0.92))",
  "color:var(--pc-fg, #fff)",
  "font-family:var(--pc-font, system-ui, sans-serif)",
  "margin:0",
  "padding:0",
  "border:0",
  "max-width:none",
  "max-height:none",
  "width:100%",
  "height:100%",
].join(";")

const STAGE_STYLE = [
  "position:relative",
  "flex:1 1 auto",
  "width:100%",
  "display:flex",
  "align-items:center",
  "justify-content:center",
  "overflow:hidden",
  "touch-action:none",
].join(";")

const CAPTION_STYLE = [
  "flex:0 0 auto",
  "max-width:90ch",
  "padding:0.75rem 1rem",
  "text-align:center",
  "line-height:1.4",
  "font-size:0.95rem",
].join(";")

const COUNTER_STYLE = [
  "position:absolute",
  "top:0.75rem",
  "inset-inline-end:0.75rem",
  "font-size:0.85rem",
  "opacity:0.8",
].join(";")

const IMG_STYLE = [
  "max-width:100%",
  "max-height:100%",
  "user-select:none",
  "-webkit-user-drag:none",
  "transform-origin:0 0",
  "will-change:transform",
].join(";")

/**
 * A high-level viewer that composes Pencere core, DialogController,
 * GestureEngine, LiveRegion, and loadImage into a working lightbox.
 *
 * The visual design is intentionally minimal. Theming lives in CSS
 * custom properties (`--pc-bg`, `--pc-fg`, `--pc-font`) so callers
 * can rebrand without a build step.
 */
export class PencereViewer<T extends Item = Item> {
  readonly core: Pencere<T>
  readonly root: HTMLElement
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

    // Prefer the native <dialog> element for top-layer, inertness, ESC.
    const root = doc.createElement("dialog")
    root.style.cssText = ROOT_STYLE
    root.setAttribute("aria-label", this.t("dialogLabel"))
    root.setAttribute("aria-roledescription", "carousel")

    const stage = doc.createElement("div")
    stage.style.cssText = STAGE_STYLE
    stage.setAttribute("role", "group")
    stage.setAttribute("aria-roledescription", "slide")

    const slot = doc.createElement("div")
    slot.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center"

    const caption = doc.createElement("figcaption")
    caption.style.cssText = CAPTION_STYLE
    caption.id = `pencere-caption-${Math.random().toString(36).slice(2, 10)}`

    const counter = doc.createElement("div")
    counter.style.cssText = COUNTER_STYLE

    const closeButton = this.makeButton(doc, "close", "×")
    closeButton.style.cssText +=
      ";position:absolute;top:0.5rem;inset-inline-start:0.5rem;font-size:1.75rem"

    const prevButton = this.makeButton(doc, "previous", "‹")
    prevButton.style.cssText +=
      ";position:absolute;inset-inline-start:0.5rem;top:50%;transform:translateY(-50%);font-size:2rem"

    const nextButton = this.makeButton(doc, "next", "›")
    nextButton.style.cssText +=
      ";position:absolute;inset-inline-end:0.5rem;top:50%;transform:translateY(-50%);font-size:2rem"

    stage.append(slot, prevButton, nextButton)
    root.append(closeButton, stage, caption, counter)
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
        if (this.currentImg) this.currentImg.style.transform = toCss(snapshot.transform)
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

    this.core.events.on("open", () => void this.renderSlide())
    this.core.events.on("change", () => void this.renderSlide())
    this.core.events.on("close", () => {
      this.dialog.hide()
      this.gesture.detach()
      this.gesture.reset()
    })
  }

  async open(index?: number): Promise<void> {
    await this.core.open(index)
    this.dialog.show()
    this.gesture.attach()
  }

  async close(reason: CloseReason = "api"): Promise<void> {
    await this.core.close(reason)
  }

  destroy(): void {
    this.cleanup.abort()
    this.loadAbort?.abort()
    this.gesture.detach()
    this.dialog.destroy()
    this.liveRegion.destroy()
    this.reducedMotion.dispose()
    this.core.destroy()
    this.root.remove()
  }

  private makeButton(doc: Document, key: keyof PencereStrings, label: string): HTMLButtonElement {
    const b = doc.createElement("button")
    b.type = "button"
    b.setAttribute("aria-label", this.t(key))
    // textContent keeps the visible glyph safe from XSS.
    b.textContent = label
    b.style.cssText = [
      "min-width:44px",
      "min-height:44px",
      "background:transparent",
      "color:inherit",
      "border:0",
      "cursor:pointer",
      "font:inherit",
    ].join(";")
    return b
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
    this.slot.style.aspectRatio = computeAspectRatio(imageItem)

    try {
      const { element } = await loadImage(imageItem, this.loadAbort.signal, this.opts.image)
      if (this.loadAbort.signal.aborted) return
      element.style.cssText = IMG_STYLE
      this.slot.textContent = ""
      this.slot.appendChild(element)
      this.currentImg = element
      this.core.events.emit("slideLoad", { index: this.core.state.index, item })
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      this.slot.textContent = "Image failed to load"
    }
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
      default:
        // zoom actions are plumbed in a later pass
        break
    }
  }

  /** For tests: is the user in reduced-motion mode? */
  get isReducedMotion(): boolean {
    if (this.opts.reducedMotion === "always") return true
    if (this.opts.reducedMotion === "never") return false
    return this.reducedMotion.matches
  }
}
