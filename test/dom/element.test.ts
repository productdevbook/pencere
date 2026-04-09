import { beforeEach, describe, expect, it } from "vitest";
import { PencereElement, registerPencereElement } from "../../src/adapters/element";

class StubImage {
  public src = "";
  public srcset = "";
  public sizes = "";
  public alt = "";
  public width = 0;
  public height = 0;
  public complete = true;
  public naturalWidth = 100;
  public naturalHeight = 100;
  public decoding = "";
  public crossOrigin: string | null = null;
  public referrerPolicy = "";
  public style: { cssText: string; transform: string } = { cssText: "", transform: "" };
  addEventListener(_: string, fn: () => void): void {
    queueMicrotask(fn);
  }
  removeEventListener(): void {}
  setAttribute(): void {}
}

describe("<pencere-lightbox>", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // @ts-expect-error — test stub
    globalThis.Image = StubImage;
    registerPencereElement();
  });

  it("registers the custom element exactly once", () => {
    registerPencereElement();
    expect(customElements.get("pencere-lightbox")).toBe(PencereElement);
  });

  it("parses items attribute on connect", () => {
    const el = document.createElement("pencere-lightbox") as PencereElement;
    el.setAttribute("items", JSON.stringify([{ src: "https://example.com/a.jpg", alt: "A" }]));
    document.body.appendChild(el);
    // internal viewer is created; we verify by reflecting into the DOM.
    expect(document.querySelector("dialog")).toBeTruthy();
  });

  it("ignores malformed items JSON", () => {
    const el = document.createElement("pencere-lightbox") as PencereElement;
    el.setAttribute("items", "not json");
    document.body.appendChild(el);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("cleans up on disconnect", () => {
    const el = document.createElement("pencere-lightbox") as PencereElement;
    el.setAttribute("items", JSON.stringify([{ src: "https://example.com/a.jpg", alt: "A" }]));
    document.body.appendChild(el);
    el.remove();
    expect(document.querySelector("dialog")).toBeNull();
  });
});
