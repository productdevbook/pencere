import { FocusTrap } from "./focus-trap"
import { lockScroll, unlockScroll } from "./scroll-lock"

export interface DialogControllerOptions {
  /**
   * Accessible label shown to assistive technology. If omitted
   * the controller looks for an element inside `root` referenced
   * via `aria-labelledby`.
   */
  label?: string
  /**
   * If true (default) the controller uses `HTMLDialogElement.showModal()`
   * when `root` is a `<dialog>` element. When false, or when the root
   * is not a dialog, the controller falls back to `inert` on siblings.
   */
  useNativeDialog?: boolean
  /** Lock page scroll while open (default true). */
  lockScroll?: boolean
  /** Called when the user dismisses via ESC / backdrop. */
  onDismiss?: (reason: "escape" | "backdrop") => void
}

/**
 * Thin DOM-layer wrapper around a dialog element that applies the
 * APG Dialog (Modal) pattern: role=dialog, aria-modal, focus trap,
 * scroll lock, and inert siblings.
 *
 * It is intentionally UI-free: the caller supplies the `root` element
 * and decides what to render inside. This keeps the core decoupled
 * from any particular visual design.
 */
interface CloseWatcherLike {
  requestClose(): void
  destroy(): void
  oncancel: ((e: Event) => void) | null
  onclose: ((e: Event) => void) | null
}
interface CloseWatcherCtor {
  new (): CloseWatcherLike
}

export class DialogController {
  private readonly root: HTMLElement
  private readonly opts: DialogControllerOptions
  private readonly trap: FocusTrap
  private readonly inertTargets = new Set<Element>()
  private closeWatcher: CloseWatcherLike | null = null
  private open = false
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.open) return
    if (e.key === "Escape") {
      e.preventDefault()
      this.opts.onDismiss?.("escape")
    }
  }
  private readonly onDialogCancel = (e: Event): void => {
    // The native <dialog> fires 'cancel' on ESC; forward it.
    e.preventDefault()
    this.opts.onDismiss?.("escape")
  }

  constructor(root: HTMLElement, opts: DialogControllerOptions = {}) {
    this.root = root
    this.opts = opts
    this.trap = new FocusTrap(root, { returnFocus: true })
    this.applyAriaBaseline()
  }

  show(): void {
    if (this.open) return
    this.open = true
    if (this.shouldUseNative()) {
      const dialog = this.root as HTMLDialogElement
      if (!dialog.open) dialog.showModal()
      dialog.addEventListener("cancel", this.onDialogCancel)
    } else {
      this.root.hidden = false
      this.applyInertSiblings()
      this.root.ownerDocument.addEventListener("keydown", this.onKeyDown, true)
    }
    // CloseWatcher intercepts Android back-button and browser close
    // requests uniformly with Escape. Gracefully no-op on browsers
    // without the API (Firefox, older Safari).
    this.installCloseWatcher()
    if (this.opts.lockScroll !== false) lockScroll(this.root.ownerDocument)
    this.trap.activate()
  }

  hide(): void {
    if (!this.open) return
    this.open = false
    this.teardownCloseWatcher()
    this.trap.deactivate()
    if (this.opts.lockScroll !== false) unlockScroll(this.root.ownerDocument)
    if (this.shouldUseNative()) {
      const dialog = this.root as HTMLDialogElement
      dialog.removeEventListener("cancel", this.onDialogCancel)
      if (dialog.open) dialog.close()
    } else {
      this.root.hidden = true
      this.releaseInertSiblings()
      this.root.ownerDocument.removeEventListener("keydown", this.onKeyDown, true)
    }
  }

  get isOpen(): boolean {
    return this.open
  }

  destroy(): void {
    this.hide()
    this.root.removeAttribute("role")
    this.root.removeAttribute("aria-modal")
  }

  [Symbol.dispose](): void {
    this.destroy()
  }

  private installCloseWatcher(): void {
    const view = this.root.ownerDocument.defaultView as
      | (Window & {
          CloseWatcher?: CloseWatcherCtor
        })
      | null
    const Ctor = view?.CloseWatcher
    if (!Ctor) return
    try {
      const watcher = new Ctor()
      watcher.oncancel = (e: Event): void => {
        e.preventDefault()
        this.opts.onDismiss?.("escape")
      }
      this.closeWatcher = watcher
    } catch {
      // Some engines throw if too many watchers are stacked; ignore.
    }
  }

  private teardownCloseWatcher(): void {
    if (!this.closeWatcher) return
    try {
      this.closeWatcher.destroy()
    } catch {
      // ignore
    }
    this.closeWatcher = null
  }

  private shouldUseNative(): boolean {
    if (this.opts.useNativeDialog === false) return false
    return (
      this.root.tagName === "DIALOG" &&
      typeof (this.root as HTMLDialogElement).showModal === "function"
    )
  }

  private applyAriaBaseline(): void {
    if (this.root.tagName !== "DIALOG") {
      if (!this.root.hasAttribute("role")) this.root.setAttribute("role", "dialog")
    }
    this.root.setAttribute("aria-modal", "true")
    if (this.opts.label) this.root.setAttribute("aria-label", this.opts.label)
  }

  /**
   * Walk from the root up toward <body> and mark every sibling along
   * the way `inert`. This matches the ARIA APG Dialog (Modal) pattern
   * — the only element reachable to AT/keyboard is the dialog itself.
   *
   * Walking ancestors (rather than only `document.body.children`)
   * matters when the consumer attaches the viewer inside a custom
   * container: the viewer's own ancestors must stay interactive for
   * the root to remain focusable, while everything *beside* them at
   * each level becomes inert.
   */
  private applyInertSiblings(): void {
    let node: Element | null = this.root
    const body = this.root.ownerDocument.body
    while (node && node !== body && node.parentElement) {
      const parent: HTMLElement = node.parentElement
      for (const sibling of Array.from(parent.children) as Element[]) {
        if (sibling === node) continue
        if (sibling.hasAttribute("inert")) continue
        sibling.setAttribute("inert", "")
        this.inertTargets.add(sibling)
      }
      node = parent
    }
    // Finally, any siblings of <body>'s direct children that aren't
    // ancestors of the root (e.g. adjacent <main>, <header>, <nav>).
    if (body) {
      for (const child of Array.from(body.children)) {
        if (child === this.root || child.contains(this.root)) continue
        if (child.hasAttribute("inert")) continue
        child.setAttribute("inert", "")
        this.inertTargets.add(child)
      }
    }
  }

  private releaseInertSiblings(): void {
    for (const el of this.inertTargets) el.removeAttribute("inert")
    this.inertTargets.clear()
  }
}
