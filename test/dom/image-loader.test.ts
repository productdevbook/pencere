import { beforeEach, describe, expect, it } from "vitest";
import { computeAspectRatio, loadImage } from "../../src/dom/image-loader";
import type { ImageItem } from "../../src/index";

describe("computeAspectRatio()", () => {
  it("returns w/h when both are present", () => {
    expect(computeAspectRatio({ width: 1600, height: 900 })).toBe("1600 / 900");
  });

  it("falls back to 3/2 when unknown", () => {
    expect(computeAspectRatio({})).toBe("3 / 2");
  });

  it("falls back to 3/2 when width is 0", () => {
    expect(computeAspectRatio({ width: 0, height: 10 })).toBe("3 / 2");
  });
});

describe("loadImage()", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("rejects unsafe src (javascript:)", async () => {
    const item: ImageItem = { type: "image", src: "javascript:alert(1)" };
    await expect(loadImage(item, new AbortController().signal)).rejects.toThrow(/unsafe/);
  });

  it("applies alt, srcset, sizes, and fetchpriority", async () => {
    // Stub Image to fire load synchronously
    const origImage = globalThis.Image;
    class StubImage {
      public src = "";
      public srcset = "";
      public sizes = "";
      public alt = "";
      public width = 0;
      public height = 0;
      public complete = true;
      public naturalWidth = 100;
      public naturalHeight = 50;
      public decoding = "";
      public crossOrigin: string | null = null;
      public referrerPolicy = "";
      private attrs: Record<string, string> = {};
      addEventListener(_: string, fn: () => void): void {
        queueMicrotask(fn);
      }
      removeEventListener(): void {}
      setAttribute(k: string, v: string): void {
        this.attrs[k] = v;
      }
      getAttribute(k: string): string | null {
        return this.attrs[k] ?? null;
      }
    }
    // @ts-expect-error — test stub
    globalThis.Image = StubImage;
    try {
      const item: ImageItem = {
        type: "image",
        src: "https://example.com/a.jpg",
        alt: "alt text",
        srcset: "a.jpg 1x",
        sizes: "100vw",
      };
      const result = await loadImage(item, new AbortController().signal, { priority: "high" });
      expect(result.width).toBe(100);
      expect(result.height).toBe(50);
      const img = result.element as unknown as StubImage;
      expect(img.alt).toBe("alt text");
      expect(img.srcset).toBe("a.jpg 1x");
      expect(img.sizes).toBe("100vw");
      expect(img.getAttribute("fetchpriority")).toBe("high");
      expect(img.decoding).toBe("async");
      expect(img.referrerPolicy).toBe("strict-origin-when-cross-origin");
    } finally {
      globalThis.Image = origImage;
    }
  });

  it("aborts via AbortSignal", async () => {
    const origImage = globalThis.Image;
    class StubImage {
      public src = "";
      public complete = false;
      public naturalWidth = 0;
      public naturalHeight = 0;
      addEventListener(): void {}
      removeEventListener(): void {}
      setAttribute(): void {}
    }
    // @ts-expect-error — test stub
    globalThis.Image = StubImage;
    try {
      const ctrl = new AbortController();
      const item: ImageItem = { type: "image", src: "https://example.com/a.jpg" };
      const p = loadImage(item, ctrl.signal);
      ctrl.abort();
      await expect(p).rejects.toThrow(/aborted/);
    } finally {
      globalThis.Image = origImage;
    }
  });
});
