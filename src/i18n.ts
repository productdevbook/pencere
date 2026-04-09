/**
 * Default English strings + minimal interpolation.
 *
 * A lightweight `deps.i18n` hook in PencereViewerOptions lets callers
 * plug in any translation library (`i18next`, `@formatjs/intl`, ...).
 * No runtime dependency is pulled in by default.
 */

export interface PencereStrings {
  close: string;
  previous: string;
  next: string;
  /** Template: `Image {index} of {total}` */
  counter: string;
  loading: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  /** Default accessible name for the dialog element. */
  dialogLabel: string;
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
};

export type Translator = (
  key: keyof PencereStrings,
  vars?: Record<string, string | number>,
) => string;

/** Create a translator that merges user overrides with DEFAULT_STRINGS. */
export function createTranslator(overrides?: Partial<PencereStrings>): Translator {
  const table: PencereStrings = { ...DEFAULT_STRINGS, ...overrides };
  return (key, vars) => {
    const template = table[key];
    if (!vars) return template;
    return template.replaceAll(/\{(\w+)\}/g, (_, name: string) =>
      String(vars[name] ?? `{${name}}`),
    );
  };
}
