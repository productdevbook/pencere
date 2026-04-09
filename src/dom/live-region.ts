/**
 * Polite live region for screen-reader announcements of slide changes.
 *
 * A single visually-hidden <div aria-live="polite" aria-atomic="true">
 * node is attached to the dialog root. The caller debounces updates so
 * rapid arrow-key scrubbing does not flood the SR buffer.
 */
export class LiveRegion {
  private readonly node: HTMLDivElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = "";
  private readonly debounceMs: number;

  constructor(owner: HTMLElement, debounceMs = 50) {
    this.debounceMs = debounceMs;
    const doc = owner.ownerDocument;
    this.node = doc.createElement("div");
    this.node.setAttribute("aria-live", "polite");
    this.node.setAttribute("aria-atomic", "true");
    // Visually hidden per APG. Avoid display:none which hides from SR.
    this.node.style.cssText = [
      "position:absolute",
      "width:1px",
      "height:1px",
      "margin:-1px",
      "padding:0",
      "overflow:hidden",
      "clip:rect(0 0 0 0)",
      "white-space:nowrap",
      "border:0",
    ].join(";");
    owner.appendChild(this.node);
  }

  announce(message: string): void {
    this.pending = message;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.node.textContent = this.pending;
      this.timer = null;
    }, this.debounceMs);
  }

  /** For tests: flush the pending announcement synchronously. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending) this.node.textContent = this.pending;
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.node.remove();
  }

  get element(): HTMLDivElement {
    return this.node;
  }
}
