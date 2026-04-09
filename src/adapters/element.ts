/**
 * Web Component wrapper — `<pencere-lightbox>`.
 *
 * Parses a JSON `items` attribute, reflects the `open` attribute,
 * dispatches `pencere:open` / `pencere:close` / `pencere:change`
 * custom events, and cleans up on disconnect.
 *
 * Register explicitly via `registerPencereElement()`.
 */
import { PencereViewer } from "../dom/viewer";
import type { ImageItem } from "../types";

function parseItems(raw: string | null): ImageItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is { src: string } =>
          !!entry && typeof (entry as { src: unknown }).src === "string",
      )
      .map((entry) => ({ type: "image", ...(entry as object) }) as ImageItem);
  } catch {
    return [];
  }
}

export class PencereElement extends HTMLElement {
  static observedAttributes = ["items", "open", "start-index"];
  private viewer: PencereViewer<ImageItem> | null = null;

  connectedCallback(): void {
    this.build();
  }

  disconnectedCallback(): void {
    this.viewer?.destroy();
    this.viewer = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.isConnected) return;
    if (name === "items") {
      this.build();
      return;
    }
    if (name === "open") {
      if (value === null) void this.viewer?.close("api");
      else void this.viewer?.open();
      return;
    }
  }

  private build(): void {
    this.viewer?.destroy();
    const items = parseItems(this.getAttribute("items"));
    if (items.length === 0) return;
    const startIndex = Number(this.getAttribute("start-index") ?? "0") || 0;
    this.viewer = new PencereViewer<ImageItem>({ items, startIndex });
    this.viewer.core.events.on("open", () => this.dispatchEvent(new CustomEvent("pencere:open")));
    this.viewer.core.events.on("change", (e) =>
      this.dispatchEvent(new CustomEvent("pencere:change", { detail: e })),
    );
    this.viewer.core.events.on("close", () => this.dispatchEvent(new CustomEvent("pencere:close")));
    if (this.hasAttribute("open")) void this.viewer.open(startIndex);
  }
}

export function registerPencereElement(name = "pencere-lightbox"): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(name)) return;
  customElements.define(name, PencereElement);
}
