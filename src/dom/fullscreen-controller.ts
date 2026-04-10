export interface FullscreenControllerOptions {
  /** The root element to place into fullscreen. */
  element: HTMLElement
  /** Whether fullscreen is enabled for this viewer. */
  enabled: boolean
  /**
   * CSS class toggled on `element` as a faux-fullscreen fallback
   * when the Fullscreen API is unavailable (iOS Safari).
   */
  fauxClassName?: string
  /** Called on native `fullscreenchange` for the element. */
  onChange?: (isFullscreen: boolean) => void
  /** Abort signal used to tear down the fullscreenchange listener. */
  signal?: AbortSignal
}

/**
 * Fullscreen API wrapper (#14). Handles native
 * `requestFullscreen` / `exitFullscreen` and a CSS-class
 * faux-fullscreen for engines that refuse real fullscreen
 * (iOS Safari).
 */
export class FullscreenController {
  private readonly element: HTMLElement
  private readonly enabled: boolean
  private readonly fauxClassName: string
  private readonly onChange: ((isFullscreen: boolean) => void) | undefined

  constructor(options: FullscreenControllerOptions) {
    this.element = options.element
    this.enabled = options.enabled
    this.fauxClassName = options.fauxClassName ?? "pc-root--faux-fullscreen"
    this.onChange = options.onChange

    if (typeof document === "undefined") return
    const doc = this.element.ownerDocument
    if (!doc) return
    if (this.onChange) {
      const handler = (): void => {
        this.onChange?.(this.isFullscreen())
      }
      doc.addEventListener("fullscreenchange", handler, { signal: options.signal })
    }
  }

  /** Is the element currently in fullscreen (real or faux)? */
  isFullscreen(): boolean {
    if (typeof document === "undefined") return false
    const doc = this.element.ownerDocument
    if (!doc) return false
    if (doc.fullscreenElement === this.element) return true
    return this.element.classList.contains(this.fauxClassName)
  }

  /**
   * Enter fullscreen. Prefers native requestFullscreen, falls back
   * to a CSS faux-fullscreen class. No-op when disabled.
   */
  async enter(): Promise<void> {
    if (!this.enabled) return
    if (typeof document === "undefined") return
    if (typeof this.element.requestFullscreen === "function") {
      try {
        await this.element.requestFullscreen()
        return
      } catch {
        // Fall through to faux-fullscreen.
      }
    }
    this.element.classList.add(this.fauxClassName)
  }

  /** Exit fullscreen (real or faux). */
  async exit(): Promise<void> {
    if (typeof document === "undefined") return
    const doc = this.element.ownerDocument
    if (!doc) {
      this.element.classList.remove(this.fauxClassName)
      return
    }
    if (doc.fullscreenElement === this.element) {
      try {
        await doc.exitFullscreen()
      } catch {
        /* ignore */
      }
    }
    this.element.classList.remove(this.fauxClassName)
  }

  /** Toggle between windowed and fullscreen. */
  async toggle(): Promise<void> {
    if (this.isFullscreen()) await this.exit()
    else await this.enter()
  }
}
