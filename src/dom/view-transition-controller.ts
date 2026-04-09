interface ViewTransition {
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  ready?: Promise<void>
}

type DocumentWithViewTransitions = Document & {
  startViewTransition?: (cb: () => unknown | Promise<unknown>) => ViewTransition
}

export interface ViewTransitionControllerOptions {
  /** The document whose `startViewTransition` should be used. */
  document?: Document
  /** Whether view transitions are enabled for this viewer. */
  enabled: boolean
}

/**
 * `document.startViewTransition` wrapper (#12). Runs the given
 * update callback inside a view transition, waiting for the DOM
 * mutation to commit before invoking the `afterUpdate` hook and
 * then awaiting the full animation. Degrades gracefully to an
 * instant update on engines without support.
 */
export class ViewTransitionController {
  private readonly enabled: boolean
  private readonly doc: DocumentWithViewTransitions | null

  constructor(options: ViewTransitionControllerOptions) {
    this.enabled = options.enabled
    if (typeof document === "undefined") {
      this.doc = options.document ? (options.document as DocumentWithViewTransitions) : null
    } else {
      this.doc = (options.document ?? document) as DocumentWithViewTransitions
    }
  }

  /** Whether the host environment supports the View Transitions API. */
  get supported(): boolean {
    return this.enabled && !!this.doc && typeof this.doc.startViewTransition === "function"
  }

  /**
   * Run `update` inside a view transition. Resolves once the DOM
   * callback has committed AND the animation has finished. On
   * unsupported engines, just runs `update()` directly.
   *
   * `afterUpdate` is invoked after the callback commits but before
   * the animation starts — use it to clear shared
   * `view-transition-name` properties from the origin element so
   * the old node stops competing with the destination for the name.
   */
  async run(update: () => void | Promise<void>, afterUpdate?: () => void): Promise<void> {
    if (!this.supported || !this.doc || typeof this.doc.startViewTransition !== "function") {
      await update()
      afterUpdate?.()
      return
    }
    const vt = this.doc.startViewTransition(async () => {
      await update()
    })
    try {
      await vt.updateCallbackDone
      afterUpdate?.()
      await vt.finished
    } catch {
      /* ignore aborted transition */
      afterUpdate?.()
    }
  }
}
