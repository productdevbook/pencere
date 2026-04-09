import { firstTabbable, getTabbable, isTabbable, lastTabbable } from "./focusable"

export interface FocusTrapOptions {
  /**
   * Element to receive focus when the trap is activated.
   * If omitted the first tabbable descendant is used.
   */
  initialFocus?: HTMLElement | (() => HTMLElement | null)
  /**
   * When deactivating, restore focus to the element that was active
   * before activation. Defaults to true.
   */
  returnFocus?: boolean
}

/**
 * Minimal, spec-aligned focus trap.
 *
 * - Moves focus into `root` on activate().
 * - Wraps Tab / Shift+Tab so focus cannot escape.
 * - On deactivate(), restores focus to the element that had it
 *   before activation.
 * - Does not depend on `inert` — callers should apply `inert` to
 *   siblings separately to hide them from AT.
 */
export class FocusTrap {
  private readonly root: HTMLElement
  private readonly opts: FocusTrapOptions
  private previouslyFocused: Element | null = null
  private active = false
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.active || e.key !== "Tab") return
    const tabbable = getTabbable(this.root)
    if (tabbable.length === 0) {
      e.preventDefault()
      this.root.focus({ preventScroll: true })
      return
    }
    const first = tabbable[0]!
    const last = tabbable[tabbable.length - 1]!
    const active = this.root.ownerDocument.activeElement as HTMLElement | null
    if (e.shiftKey) {
      if (active === first || !this.root.contains(active)) {
        e.preventDefault()
        last.focus({ preventScroll: true })
      }
    } else if (active === last) {
      e.preventDefault()
      first.focus({ preventScroll: true })
    }
  }

  constructor(root: HTMLElement, opts: FocusTrapOptions = {}) {
    this.root = root
    this.opts = opts
  }

  activate(): void {
    if (this.active) return
    this.active = true
    this.previouslyFocused = this.root.ownerDocument.activeElement
    const initial = this.resolveInitialFocus()
    initial?.focus({ preventScroll: true })
    this.root.ownerDocument.addEventListener("keydown", this.onKeyDown, true)
  }

  deactivate(): void {
    if (!this.active) return
    this.active = false
    this.root.ownerDocument.removeEventListener("keydown", this.onKeyDown, true)
    if (this.opts.returnFocus !== false && this.previouslyFocused instanceof HTMLElement) {
      this.previouslyFocused.focus({ preventScroll: true })
    }
    this.previouslyFocused = null
  }

  get isActive(): boolean {
    return this.active
  }

  private resolveInitialFocus(): HTMLElement | null {
    const { initialFocus } = this.opts
    if (typeof initialFocus === "function") return initialFocus()
    if (initialFocus) return initialFocus
    return firstTabbable(this.root) ?? this.root
  }
}

export { firstTabbable, getTabbable, isTabbable, lastTabbable }
