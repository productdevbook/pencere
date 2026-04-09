import { Pencere } from "../core"
import { createTranslator } from "../i18n"
import type { PencereStrings, Translator } from "../i18n"
import type { CloseReason, Item, PencereOptions } from "../types"
import { DialogController } from "./dialog"
import type { DialogControllerOptions } from "./dialog"
import { FullscreenController } from "./fullscreen-controller"
import { Haptics } from "./haptics"
import type { HapticsOptions } from "./haptics"
import { runDidHook, runWillHook } from "./hooks"
import type { PencereHooks } from "./hooks"
import type { ImageLoaderOptions } from "./image-loader"
import { resolveKeyAction } from "./keyboard"
import type { KeyboardMapOptions } from "./keyboard"
import { LiveRegion } from "./live-region"
import { prefersReducedMotion } from "./media-query"
import { MotionController } from "./motion-controller"
import type { ActiveRendererSlot } from "./render-pipeline"
import { renderSlide } from "./render-pipeline"
import type { Renderer } from "./renderers"
import { resolveRouting, RoutingController } from "./routing-controller"
import type { ResolvedRouting, RoutingOptions } from "./routing-controller"
import { injectStyles } from "./styles"
import { ViewTransitionController } from "./view-transition-controller"

export type { RoutingOptions } from "./routing-controller"

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
  /**
   * Lifecycle hooks (Phase 2 of the architecture refactor). Gives
   * plugins + controlled-mode consumers a way to observe and gate
   * open / close / render / navigate transitions without
   * subclassing the viewer. See `PencereHooks` for details.
   */
  hooks?: PencereHooks<T>
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
  private readonly motion: MotionController
  private readonly reducedMotion: ReturnType<typeof prefersReducedMotion>
  private readonly t: Translator
  private readonly opts: PencereViewerOptions<T>
  private loadAbort: AbortController | null = null
  private currentImg: HTMLImageElement | null = null
  private renderPromise: Promise<void> | null = null
  private currentRendererEl: ActiveRendererSlot | null = null
  private readonly cleanup = new AbortController()
  private readonly onKeyDown: (e: KeyboardEvent) => void
  private direction: "ltr" | "rtl"
  private readonly haptics: Haptics
  private readonly routing: ResolvedRouting | null
  private readonly routingController: RoutingController
  private readonly fullscreenController: FullscreenController
  private readonly viewTransition: ViewTransitionController

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
    this.motion = new MotionController({
      root,
      stage,
      getCurrentImg: () => this.currentImg,
      getDirection: () => this.direction,
      haptics: this.haptics,
      onNext: () => void this.core.next(),
      onPrev: () => void this.core.prev(),
      onDismiss: () => void this.close("user"),
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

    // MotionController owns pointerdown/move/up/cancel + wheel zoom
    // as a single state machine; wire it to the same cleanup signal.
    this.motion.attach(sig)

    // WCAG 2.4.11 Focus Not Obscured (Minimum) — when focus moves to
    // an element that happens to sit under one of the gradient toolbar
    // bands, nudge it into view. pencere's own buttons live inside
    // the toolbars themselves so they are never occluded, but consumer
    // content (rich captions with links, future video controls, the
    // eventual thumbnail strip) has to be handled too.
    root.addEventListener("focusin", (e) => this.onFocusIn(e), { signal: sig })

    this.routingController = new RoutingController({
      routing: this.routing,
      signal: sig,
      isOpen: () => this.core.state.isOpen,
      getIndex: () => this.core.state.index,
      getItemCount: () => this.core.state.items.length,
      onPopClose: (reason) => {
        void this.close(reason)
      },
    })

    this.fullscreenController = new FullscreenController({
      element: this.root,
      enabled: options.fullscreen === true,
      signal: sig,
    })

    this.viewTransition = new ViewTransitionController({
      document: doc,
      enabled: options.viewTransition === true,
    })

    this.core.events.on("open", () => {
      this.renderPromise = this.renderSlide()
    })
    this.core.events.on("change", (payload) => {
      this.renderPromise = this.renderSlide()
      this.routingController.replaceFragment()
      runDidHook(
        this.opts.hooks?.didNavigate,
        { from: payload.from, to: payload.to, item: payload.item },
        "didNavigate",
      )
    })
    this.core.events.on("close", () => {
      this.dialog.hide()
      this.root.classList.remove("pc-root--open")
      this.motion.disengage()
      this.routingController.handleClose()
    })
  }

  async open(index?: number, trigger?: HTMLElement): Promise<void> {
    // Re-resolve direction on every open so consumers that toggle
    // `<html dir>` at runtime (docs pages, i18n switchers) pick up
    // the change without having to destroy + recreate the viewer.
    // Explicit `dir: "ltr"|"rtl"` still wins because resolveDirection
    // short-circuits when the option is set.
    const container = this.opts.container ?? this.root.ownerDocument.body
    this.direction = resolveDirection(this.opts.dir, container)
    this.root.setAttribute("dir", this.direction)

    // Lifecycle: willOpen runs before anything observable changes
    // so plugins can still gate the transition (throw to abort).
    const openCtx = { index, trigger, items: this.core.state.items }
    await runWillHook(this.opts.hooks?.willOpen, openCtx)

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
      this.motion.engage()
      this.routingController.pushFragment()
      if (this.renderPromise) await this.renderPromise
    }
    if (this.viewTransition.supported) {
      if (trigger) {
        trigger.style.setProperty("view-transition-name", "pencere-hero")
      }
      await this.viewTransition.run(run, () => {
        if (trigger) trigger.style.removeProperty("view-transition-name")
      })
    } else {
      await run()
    }
    runDidHook(this.opts.hooks?.didOpen, openCtx, "didOpen")
  }

  /**
   * Look at the current `location.hash`, and if it identifies a
   * valid slide via the configured `routing.parse`, open the
   * matching index. No-op when routing is off or the URL does not
   * match. Returns `true` iff the viewer was actually opened.
   */
  async openFromLocation(): Promise<boolean> {
    const idx = this.routingController.parseCurrentLocation()
    if (idx === null) return false
    await this.open(idx)
    return true
  }

  async close(reason: CloseReason = "api"): Promise<void> {
    const closeCtx = { reason }
    await runWillHook(this.opts.hooks?.willClose, closeCtx)
    await this.core.close(reason)
    runDidHook(this.opts.hooks?.didClose, closeCtx, "didClose")
  }

  destroy(): void {
    this.cleanup.abort()
    this.motion.cancelMomentum()
    this.loadAbort?.abort()
    this.motion.disengage()
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

  private async renderSlide(): Promise<void> {
    this.loadAbort?.abort()
    this.loadAbort = new AbortController()
    // Phase 3: compose the per-slide signal with the viewer-lifetime
    // cleanup signal so `destroy()` cancels in-flight loads without
    // each subsystem having to listen on a second AbortController.
    const signal = anySignal([this.cleanup.signal, this.loadAbort.signal])
    const renderCtx = {
      index: this.core.state.index,
      item: this.core.item,
    }
    await runWillHook(this.opts.hooks?.willRender, renderCtx)
    await renderSlide({
      core: this.core,
      slot: this.slot,
      caption: this.caption,
      longDescription: this.longDescription,
      counter: this.counter,
      prevButton: this.prevButton,
      nextButton: this.nextButton,
      liveRegion: this.liveRegion,
      t: this.t,
      renderers: this.opts.renderers,
      image: this.opts.image,
      loop: this.opts.loop,
      viewTransition: this.opts.viewTransition === true,
      activeRenderer: this.currentRendererEl,
      setActiveRenderer: (slot) => {
        this.currentRendererEl = slot
      },
      setCurrentImg: (img) => {
        this.currentImg = img
      },
      signal,
      resetTransform: () => this.motion.reset(),
      applyCurrentTransform: (img) => this.motion.applyCurrentTransform(img),
    })
    runDidHook(this.opts.hooks?.didRender, renderCtx, "didRender")
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
    const zoomed = this.motion.scale > 1
    if (zoomed && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const step = 48
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        this.motion.panBy(step, 0)
        return
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        this.motion.panBy(-step, 0)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        this.motion.panBy(0, step)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        this.motion.panBy(0, -step)
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
        this.motion.zoomBy(1.25)
        break
      case "zoomOut":
        this.motion.zoomBy(1 / 1.25)
        break
      case "zoomReset":
        this.motion.zoomReset()
        break
      default:
        break
    }
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
    await this.fullscreenController.enter()
  }

  /** Exit fullscreen (real or faux). */
  async exitFullscreen(): Promise<void> {
    await this.fullscreenController.exit()
  }

  /** Toggle between windowed and fullscreen. */
  async toggleFullscreen(): Promise<void> {
    await this.fullscreenController.toggle()
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
 * `AbortSignal.any` polyfill. Combines multiple signals into one
 * that aborts as soon as any input aborts. Used in `renderSlide`
 * to compose the per-slide load signal with the viewer-lifetime
 * cleanup signal (Phase 3 of the refactor) so `destroy()` cancels
 * in-flight image loads without each subsystem having to listen on
 * a second AbortController.
 */
function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const AnyFn = (AbortSignal as unknown as { any?: (s: readonly AbortSignal[]) => AbortSignal }).any
  if (typeof AnyFn === "function") return AnyFn(signals)
  const controller = new AbortController()
  const onAbort = (s: AbortSignal): void => {
    if (!controller.signal.aborted) controller.abort(s.reason)
  }
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason)
      break
    }
    s.addEventListener("abort", () => onAbort(s), { once: true })
  }
  return controller.signal
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
