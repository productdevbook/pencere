/**
 * CSP-friendly style injection.
 *
 * All static viewer CSS lives here as a single string. It is attached
 * either via `adoptedStyleSheets` (constructable stylesheet — no CSP
 * implications at all) or, when that API is unavailable, via a
 * `<style>` element stamped with the caller-supplied nonce.
 *
 * Runtime values (current transform, opacity, slot aspect ratio…) are
 * written as CSS custom properties on individual elements via
 * `element.style.setProperty("--pc-*", …)`, which only requires
 * `style-src-attr` and is compatible with strict CSP.
 *
 * See README "Content Security Policy cookbook" for the matching
 * header configuration.
 */

export const PC_STYLES = `
.pc-root {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--pc-bg, rgba(0, 0, 0, 0.92));
  color: var(--pc-fg, #fff);
  font-family: var(--pc-font, system-ui, sans-serif);
  margin: 0;
  padding: 0;
  border: 0;
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  opacity: var(--pc-root-opacity, 1);
}
.pc-root[open],
.pc-root.pc-root--open {
  display: flex;
  animation: pc-root-in 200ms ease-out;
}
.pc-root.pc-root--closing {
  display: flex;
  animation: pc-root-out 180ms ease-in forwards;
}
/* Native <dialog>'s ::backdrop defaults to transparent, so the
 * 0.92 root background would leak page content through. Force
 * the ::backdrop fully opaque with the same custom property the
 * root uses. iOS Safari ignores ::backdrop on <dialog> entirely
 * but still honors the .pc-root background, so both paths stay
 * consistent. */
.pc-root::backdrop {
  background: var(--pc-bg, rgba(0, 0, 0, 0.96));
}
.pc-root[open][open]::backdrop,
.pc-root.pc-root--open::backdrop {
  animation: pc-root-in 200ms ease-out;
}
.pc-root.pc-root--closing::backdrop {
  animation: pc-root-out 180ms ease-in forwards;
}
@keyframes pc-root-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes pc-root-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-root[open],
  .pc-root.pc-root--open,
  .pc-root.pc-root--closing {
    animation: none !important;
  }
}
/* iOS faux-fullscreen (#14). Overrides any parent transform so the
 * viewer covers the visual viewport, and bumps z-index above any
 * page chrome or sticky headers. */
.pc-root.pc-root--faux-fullscreen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  z-index: 2147483647;
  transform: none !important;
}
.pc-stage {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
}
.pc-slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: var(--pc-slot-ar, auto);
}
/* ThumbHash / BlurHash placeholder background while the full-res
 * image decodes (#29). The consumer supplies any CSS background
 * value via the --pc-slot-placeholder custom property; pencere
 * mounts it here and strips the class one rAF after the real
 * image lands. */
.pc-slot.pc-slot--placeholder {
  background: var(--pc-slot-placeholder, #0000);
  background-size: cover;
  background-position: center;
  transition: opacity 160ms ease-out;
}
.pc-img {
  max-width: 100%;
  max-height: 100%;
  user-select: none;
  -webkit-user-drag: none;
  transform-origin: center center;
  /* will-change is managed dynamically by the viewer on gesture
     start/end to avoid keeping a compositor layer alive forever (#34). */
  transform: var(--pc-img-transform, none);
}
.pc-toolbar-top,
.pc-toolbar-bottom {
  position: absolute;
  inset-inline: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 2;
}
.pc-toolbar-top {
  top: 0;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  gap: 1rem;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
}
.pc-toolbar-bottom {
  bottom: 0;
  justify-content: center;
  padding: 1rem 1.5rem 1.25rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
}
.pc-caption {
  margin: 0 auto;
  max-width: 90ch;
  text-align: center;
  line-height: 1.4;
  font-size: 0.95rem;
  /*
   * CJK-aware line breaking (#61). overflow-wrap: anywhere ensures
   * very long Latin tokens wrap; line-break: strict pulls Japanese
   * and Chinese break rules in line with print typography
   * conventions; word-break: normal stays out of the way for
   * mixed-script content.
   */
  word-break: normal;
  overflow-wrap: anywhere;
  line-break: strict;
}
/* Korean convention is to avoid breaking inside eojeol (word units). */
.pc-caption[lang="ko"],
.pc-caption[lang^="ko-"] {
  word-break: keep-all;
}
/*
 * Script-specific font stacks (#65). Consumers override these custom
 * properties in their host CSS to plug in "Noto Sans JP", "Noto Naskh
 * Arabic", etc. without patching pencere's stylesheet.
 */
.pc-caption[lang="ja"],
.pc-caption[lang^="ja-"],
.pc-longdesc[lang="ja"],
.pc-longdesc[lang^="ja-"] {
  font-family: var(--pc-font-cjk-ja, var(--pc-font, inherit));
}
.pc-caption[lang="ko"],
.pc-caption[lang^="ko-"],
.pc-longdesc[lang="ko"],
.pc-longdesc[lang^="ko-"] {
  font-family: var(--pc-font-cjk-ko, var(--pc-font, inherit));
}
.pc-caption[lang="zh-Hans"],
.pc-caption[lang="zh-CN"],
.pc-caption[lang="zh-SG"],
.pc-longdesc[lang="zh-Hans"],
.pc-longdesc[lang="zh-CN"],
.pc-longdesc[lang="zh-SG"] {
  font-family: var(--pc-font-cjk-zh-hans, var(--pc-font, inherit));
}
.pc-caption[lang="zh-Hant"],
.pc-caption[lang="zh-TW"],
.pc-caption[lang="zh-HK"],
.pc-longdesc[lang="zh-Hant"],
.pc-longdesc[lang="zh-TW"],
.pc-longdesc[lang="zh-HK"] {
  font-family: var(--pc-font-cjk-zh-hant, var(--pc-font, inherit));
}
.pc-caption[lang="ar"],
.pc-caption[lang^="ar-"],
.pc-caption[lang="he"],
.pc-caption[lang^="he-"],
.pc-longdesc[lang="ar"],
.pc-longdesc[lang^="ar-"],
.pc-longdesc[lang="he"],
.pc-longdesc[lang^="he-"] {
  font-family: var(--pc-font-arabic, var(--pc-font, inherit));
}
.pc-counter {
  font-size: 0.85rem;
  opacity: 0.85;
  letter-spacing: 0.02em;
}
.pc-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  background: transparent;
  color: inherit;
  border: 0;
  cursor: pointer;
  font: inherit;
  pointer-events: auto;
  /* Center the glyph — both horizontally and vertically. Without
   * explicit flex centering the default button layout leaves the
   * chevrons/× drifting left on tall line-heights and glyph-rich
   * fonts. line-height:1 kills the extra baseline gap. */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  text-align: center;
  /*
   * WCAG 2.4.11 Focus Not Obscured — when the browser scrolls a
   * focused button into view, leave at least 80px of headroom under
   * the top toolbar band and above the bottom caption band so the
   * focus ring never tucks behind a gradient edge.
   */
  scroll-margin-block: 80px;
}
.pc-btn:focus-visible {
  outline: 2px solid var(--pc-focus, #7dd3fc);
  outline-offset: 2px;
  border-radius: 6px;
}
.pc-btn--close {
  font-size: 1.75rem;
}
.pc-btn--nav {
  position: absolute;
  /* Vertically center via top:0/bottom:0 + margin:auto. More robust
   * than top:50%+translateY(-50%) which can drift when the stage
   * has a pending transform from the slide-in animation. */
  top: 0;
  bottom: 0;
  margin-block: auto;
  font-size: 2rem;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.pc-btn--prev {
  inset-inline-start: 0.75rem;
}
.pc-btn--next {
  inset-inline-end: 0.75rem;
}
.pc-btn[disabled] {
  opacity: 0.35;
  cursor: not-allowed;
}
.pc-live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .pc-img {
    transition: none !important;
  }
}
@media (max-width: 640px) {
  /*
   * Narrow viewport tuning. Keeps the 44x44 hit targets for
   * WCAG 2.5.5 while tightening padding so captions, counter,
   * and nav chevrons don't steal image space on phones.
   */
  .pc-toolbar-top {
    padding: 0.5rem 0.75rem;
  }
  .pc-toolbar-bottom {
    padding: 0.75rem 1rem 1rem;
  }
  .pc-btn--nav {
    width: 44px;
    height: 44px;
    font-size: 1.6rem;
  }
  .pc-btn--prev {
    inset-inline-start: 0.4rem;
  }
  .pc-btn--next {
    inset-inline-end: 0.4rem;
  }
  .pc-btn--close {
    font-size: 1.5rem;
  }
  .pc-counter {
    font-size: 0.8rem;
  }
  .pc-caption {
    font-size: 0.85rem;
    max-width: none;
  }
}
@media (forced-colors: active) {
  /*
   * Windows High Contrast / forced-colors mode strips author colors
   * and backgrounds. Map pencere's chrome to the standard system
   * color keywords so controls stay visible and focusable without
   * relying on gradient backdrops or rgba fills.
   */
  .pc-root {
    background: Canvas;
    color: CanvasText;
    forced-color-adjust: none;
  }
  .pc-toolbar-top,
  .pc-toolbar-bottom {
    /* Gradients become flat white in forced-colors; drop them. */
    background: transparent;
  }
  .pc-btn {
    background: ButtonFace;
    color: ButtonText;
    border: 1px solid ButtonText;
  }
  .pc-btn:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
  .pc-btn[disabled] {
    color: GrayText;
    border-color: GrayText;
  }
  .pc-btn--nav {
    background: ButtonFace;
  }
  .pc-counter,
  .pc-caption {
    color: CanvasText;
  }
}
`

const INSTALL_FLAG = "__pencereStylesInstalled__"

type StyleHostWindow = (Window | typeof globalThis) & {
  [INSTALL_FLAG]?: WeakSet<Document | ShadowRoot>
}

/**
 * Ensure the static pencere stylesheet is attached to the given
 * document/shadow root. Idempotent: repeated calls on the same root
 * are no-ops.
 *
 * @param root  Document or ShadowRoot whose stylesheet set receives
 *              the rules. For a regular document, the light tree.
 * @param nonce Optional CSP nonce. Applied only when falling back to
 *              a `<style>` element (adoptedStyleSheets does not need
 *              a nonce because it has no inline representation).
 */
export function injectStyles(root: Document | ShadowRoot, nonce?: string): void {
  const doc = root instanceof Document ? root : root.ownerDocument
  const win: StyleHostWindow = (doc.defaultView ?? globalThis) as StyleHostWindow
  const registry = (win[INSTALL_FLAG] ??= new WeakSet())
  if (registry.has(root)) return
  registry.add(root)

  // Prefer constructable stylesheets when available — they sidestep
  // `style-src` entirely because there is no serializable inline form.
  const CSSSheet =
    (doc.defaultView as (Window & { CSSStyleSheet?: typeof CSSStyleSheet }) | null)
      ?.CSSStyleSheet ?? (typeof CSSStyleSheet !== "undefined" ? CSSStyleSheet : undefined)
  const hostSupportsAdopted =
    "adoptedStyleSheets" in root &&
    typeof CSSSheet === "function" &&
    // `replaceSync` shipped together with adoptedStyleSheets in
    // Chrome 73 / Safari 16.4 / Firefox 101 — treat as the capability
    // probe.
    "replaceSync" in CSSSheet.prototype
  if (hostSupportsAdopted && CSSSheet) {
    try {
      const sheet = new CSSSheet()
      sheet.replaceSync(PC_STYLES)
      const target = root as { adoptedStyleSheets: CSSStyleSheet[] }
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet]
      return
    } catch {
      // Fall through to <style> fallback.
    }
  }

  const style = doc.createElement("style")
  style.setAttribute("data-pencere", "")
  if (nonce) style.setAttribute("nonce", nonce)
  style.textContent = PC_STYLES
  const host: ParentNode = root instanceof Document ? (root.head ?? root.documentElement) : root
  host.appendChild(style)
}

/** Visible for testing. */
export function _resetStyleRegistry(): void {
  const win: StyleHostWindow = globalThis as StyleHostWindow
  delete win[INSTALL_FLAG]
  // Also strip any <style data-pencere> fallbacks the tests may have
  // appended to `document.head` on previous runs.
  if (typeof document !== "undefined") {
    for (const el of Array.from(document.querySelectorAll("style[data-pencere]"))) el.remove()
  }
}
