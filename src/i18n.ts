/**
 * Default English strings + minimal interpolation.
 *
 * A lightweight `deps.i18n` hook in PencereViewerOptions lets callers
 * plug in any translation library (`i18next`, `@formatjs/intl`, ...).
 * No runtime dependency is pulled in by default.
 */

export interface PencereStrings {
  close: string
  previous: string
  next: string
  /** Template: `Image {index} of {total}` */
  counter: string
  loading: string
  zoomIn: string
  zoomOut: string
  zoomReset: string
  /** Default accessible name for the dialog element. */
  dialogLabel: string
}

export const DEFAULT_STRINGS: PencereStrings = {
  close: "Close",
  previous: "Previous image",
  next: "Next image",
  counter: "Image {index} of {total}",
  loading: "Loading",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Reset zoom",
  dialogLabel: "Image gallery",
}

export type Translator = (
  key: keyof PencereStrings,
  vars?: Record<string, string | number>,
) => string

/**
 * Create a translator that merges user overrides with DEFAULT_STRINGS.
 *
 * SECURITY: the returned strings are NOT HTML-escaped. pencere's
 * internal consumers (caption, counter, live region, button labels)
 * all write via `textContent` so untrusted values are safe in the
 * default pipeline. If you route the output into `innerHTML` or a
 * `srcdoc` sink, sanitize it yourself or use Trusted Types.
 */
export function createTranslator(overrides?: Partial<PencereStrings>): Translator {
  const table: PencereStrings = { ...DEFAULT_STRINGS, ...overrides }
  return (key, vars) => {
    const template = table[key]
    if (!vars) return template
    return template.replaceAll(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
  }
}
