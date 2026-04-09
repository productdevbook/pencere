# pencere

> Modern, accessible, framework-agnostic lightbox — pure TypeScript, zero runtime dependencies, ESM, tree-shakeable.

[![npm version](https://img.shields.io/npm/v/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](https://npmjs.com/package/pencere)
[![npm downloads](https://img.shields.io/npm/dm/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](https://npmjs.com/package/pencere)
[![bundle size](https://img.shields.io/bundlephobia/minzip/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](https://bundlephobia.com/result?p=pencere)
[![license](https://img.shields.io/github/license/productdevbook/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](LICENSE)

> [!IMPORTANT]
> Early development. API is not stable yet. Feedback welcome on [GitHub Issues](https://github.com/productdevbook/pencere/issues).

`pencere` (Turkish for _window_) is the lightbox library that's been
missing from the ecosystem: MIT-licensed end-to-end, runs anywhere
(vanilla, React, Vue, Svelte, Solid, Web Components), and built on
web standards rather than layers of custom JS.

## Install

```bash
pnpm add pencere
```

## Quick start

```ts
import { PencereViewer } from "pencere"

const viewer = new PencereViewer({
  items: [
    {
      type: "image",
      src: "/a.jpg",
      alt: "Mountain lake at sunrise",
      caption: "Yosemite Valley",
      width: 1600,
      height: 1067,
    },
    {
      type: "image",
      src: "/b.jpg",
      alt: "Bosphorus at dusk",
      width: 1600,
      height: 1067,
    },
  ],
  loop: true,
})

document.querySelector("#open")?.addEventListener("click", () => viewer.open(0))
```

> [!TIP]
> Run `pnpm playground` to see a live docs site at `http://localhost:5173` with every gesture and keyboard shortcut wired up.

### React

```tsx
import { useLightbox } from "pencere/react"

function Gallery() {
  const { open } = useLightbox({
    items: [{ type: "image", src: "/a.jpg", alt: "A" }],
    useNativeDialog: true,
  })
  return <button onClick={() => open(0)}>View</button>
}
```

### Vue 3

```ts
import { usePencere } from "pencere/vue"

const { open } = usePencere({
  items: [{ type: "image", src: "/a.jpg", alt: "A" }],
})
```

### Svelte

```svelte
<div use:pencere={{ items: [{ type: "image", src: "/a.jpg" }] }} />

<script>
  import { pencere } from "pencere/svelte";
</script>
```

### Web Component

```html
<script type="module">
  import { registerPencereElement } from "pencere/element"
  registerPencereElement()
</script>

<pencere-lightbox items='[{"src":"/a.jpg","alt":"A"}]' start-index="0"> </pencere-lightbox>
```

## Why pencere?

| Library            | Size (gzip) | License      | Framework-agnostic | Zoom | Video  | Thumbs | TS-first | WCAG 2.2 AA | View Transitions |
| ------------------ | ----------- | ------------ | ------------------ | ---- | ------ | ------ | -------- | ----------- | ---------------- |
| **pencere**        | ~12 kB      | **MIT**      | ✅                 | ✅   | 🚧     | 🚧     | ✅       | ✅          | 🚧               |
| PhotoSwipe         | ~17 kB      | MIT          | ✅                 | ✅   | plugin | plugin | ~        | ~           | ❌               |
| GLightbox          | ~11 kB      | MIT          | ✅                 | ~    | ✅     | ❌     | ❌       | ~           | ❌               |
| Fancybox v5        | ~26 kB      | **GPL / ₺**  | ✅                 | ✅   | ✅     | ✅     | ✅       | ✅          | ❌               |
| yet-another-react… | ~14 kB      | MIT          | React only         | ~    | plugin | plugin | ✅       | ✅          | ❌               |
| lightGallery       | ~25 kB      | **GPL / ₺**  | ✅                 | ✅   | ✅     | ✅     | ✅       | ✅          | ❌               |
| Lightbox2          | ~8 kB       | MIT + jQuery | ❌                 | ❌   | ❌     | ❌     | ❌       | ❌          | ❌               |
| Spotlight.js       | ~7 kB       | Apache       | ✅                 | ~    | ✅     | ❌     | ~        | ❌          | ❌               |
| basicLightbox      | ~2 kB       | MIT          | ✅                 | ❌   | ❌     | ❌     | ~        | ❌          | ❌               |
| Swiper (lb mode)   | ~40 kB      | MIT          | ✅                 | ~    | ❌     | ✅     | ✅       | ~           | ❌               |

Key differentiators:

- **License freedom.** Fancybox and lightGallery — the two most feature-complete options — are GPL/commercial. `pencere` is MIT end to end.
- **Zero runtime dependencies.** Framework adapters are optional peer deps.
- **WCAG 2.2 AA from the start.** APG Dialog + Carousel patterns, focus trap with shadow-DOM-aware tabbable detection, minimum 24×24 target sizes, `prefers-reduced-motion` respected.
- **TypeScript-first.** Strict types, generic `Pencere<T>`, typed event emitter.
- **IME-safe keyboard.** Arrow keys and Escape ignore `isComposing` so Japanese, Korean, and Chinese users do not dismiss the lightbox while confirming IME input.
- **SSR-safe.** No `window`/`document` access at module import time; adapters use lazy mount hooks.

## Keyboard

| Key                                | Action                                    |
| ---------------------------------- | ----------------------------------------- |
| <kbd>Esc</kbd>                     | Close (Android back via CloseWatcher too) |
| <kbd>←</kbd> / <kbd>PageUp</kbd>   | Previous image                            |
| <kbd>→</kbd> / <kbd>PageDown</kbd> | Next image                                |
| <kbd>Home</kbd> / <kbd>End</kbd>   | Jump to first / last                      |
| <kbd>+</kbd> / <kbd>=</kbd>        | Zoom in 1.25×                             |
| <kbd>-</kbd>                       | Zoom out 1.25×                            |
| <kbd>0</kbd>                       | Reset zoom                                |

All shortcuts are IME-safe (ignored during `isComposing`) and can be remapped or disabled via the `keyboard` option.

## Gestures

- **Swipe left / right** at fit scale navigates between slides.
- **Swipe down** dismisses the viewer with a backdrop fade.
- **Pinch** zooms around the centroid, clamped to 1×–8×.
- **Double-tap** toggles 1× ↔ 2× zoom at the image center.
- **Mouse wheel** zooms exponentially at the cursor; zooming out past 1× snaps back to identity.
- **Pan** (one-finger drag) works once zoomed in.

## Accessibility

`pencere` is designed against the following standards:

- [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) — focus management, keyboard operability, target size (2.5.8), focus not obscured (2.4.11), dragging alternatives (2.5.7).
- [ARIA APG Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [ARIA APG Carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)
- [EN 301 549 v3.2.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/) (EU Accessibility Act)
- [JIS X 8341-3:2016](https://waic.jp/) (Japan)
- [RGAA 4.1](https://accessibilite.numerique.gouv.fr/) (France)
- [GB/T 37668-2019](http://www.gb688.cn/) (China)
- [BITV 2.0 / BFSG](https://bundesfachstelle-barrierefreiheit.de/) (Germany)
- [KWCAG 2.2](https://nuli.navercorp.com/) (South Korea)

Built-in translations: English, German, French, Spanish, Italian,
Portuguese (BR), Russian, Turkish, Arabic, Hebrew, Japanese, Simplified
Chinese, Traditional Chinese, Korean. Override any string via `strings`
option or plug in your own translator via `i18n`.

## Content Security Policy cookbook

`pencere` is written to work under a strict CSP. The minimum headers
it requires are:

```http
Content-Security-Policy:
  default-src 'self';
  img-src 'self' https: data: blob:;
  style-src 'self' 'nonce-RANDOM';
  script-src 'self' 'nonce-RANDOM';
  trusted-types pencere;
  require-trusted-types-for 'script';
```

- `style-src 'nonce-...'` — pass the same nonce to the viewer via
  `new PencereViewer({ ..., nonce: "RANDOM" })`. On modern engines
  pencere attaches its stylesheet through `adoptedStyleSheets`, which
  bypasses `style-src` entirely; the nonce is only used as a fallback
  for older browsers where a `<style nonce="...">` element is created.
  All runtime values (transform, opacity, aspect ratio) are written
  via `style.setProperty('--pc-*', ...)` so no inline `style=""`
  attribute is ever generated.
- `img-src` — `data:` and `blob:` are needed if you use LQIP or
  `URL.createObjectURL()` placeholders.
- `trusted-types pencere` — enables the library's trusted-types policy
  (only relevant if you opt into HTML captions via DOMPurify).

### Subresource Integrity (CDN)

```html
<script
  type="module"
  crossorigin="anonymous"
  src="https://unpkg.com/pencere@0.0.1/dist/index.mjs"
  integrity="sha384-REPLACE_ME_PER_RELEASE"
></script>
```

SRI hashes are published in the GitHub release notes for every tag.

## Security

See [`SECURITY.md`](./SECURITY.md) for the disclosure policy. Highlights:

- URL protocol allowlist (`javascript:`, `vbscript:`, `file:` rejected,
  including whitespace-smuggling variants).
- `textContent` for captions by default.
- `referrerpolicy="strict-origin-when-cross-origin"` on every generated
  `<img>`.
- npm releases published with `--provenance` (SLSA attestation).

## Options

```ts
interface PencereViewerOptions<T extends Item = Item> {
  items: T[]
  startIndex?: number
  loop?: boolean
  container?: HTMLElement
  strings?: Partial<PencereStrings>
  i18n?: (key: keyof PencereStrings, vars?: Record<string, string | number>) => string
  keyboard?: {
    overrides?: Partial<Record<KeyboardAction, string[]>>
    disable?: KeyboardAction[]
  }
  image?: {
    crossOrigin?: "anonymous" | "use-credentials" | null
    referrerPolicy?: ReferrerPolicy
  }
  reducedMotion?: "auto" | "always" | "never"
  useNativeDialog?: boolean
  lockScroll?: boolean
  /** CSP nonce for the fallback <style> element. */
  nonce?: string
}
```

## Roadmap

- [x] Swipe nav + drag-to-dismiss + pinch zoom (#40 #41 #42 #43 #44)
- [x] Keyboard zoom in / out / reset
- [x] CloseWatcher integration (#11)
- [ ] View Transitions API thumbnail → lightbox morph (#12)
- [ ] Native video / iframe / PDF renderers (#74)
- [ ] Virtualized thumbnail strip (#75)
- [ ] Hash-based deep linking (#73)
- [ ] ThumbHash / BlurHash placeholders (#29)
- [ ] Angular + Qwik adapters (#70)

## License

MIT © [productdevbook](https://github.com/productdevbook)
