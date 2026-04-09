/**
 * Keyboard action map shared by the DOM controller.
 *
 * The returned action is a plain string that the controller wires to
 * Pencere methods. Keeping the mapping data-only makes it trivial to
 * override per WCAG 2.1.4 (Character Key Shortcuts).
 */
export type KeyboardAction =
  | "close"
  | "next"
  | "prev"
  | "first"
  | "last"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "toggleSlideshow"

export interface KeyboardMapOptions {
  /** Override the default binding for a given action. */
  overrides?: Partial<Record<KeyboardAction, string[]>>
  /** Disable specific actions entirely. */
  disable?: KeyboardAction[]
}

const DEFAULT_MAP: Record<KeyboardAction, string[]> = {
  close: ["Escape"],
  next: ["ArrowRight", "PageDown"],
  prev: ["ArrowLeft", "PageUp"],
  first: ["Home"],
  last: ["End"],
  zoomIn: ["+", "="],
  zoomOut: ["-"],
  zoomReset: ["0"],
  toggleSlideshow: [" "],
}

/**
 * Resolve a KeyboardEvent to an action, or `null` when no binding
 * matches or the event should be ignored (IME composition, modifier
 * keys, focus on a form field).
 */
export function resolveKeyAction(
  event: KeyboardEvent,
  options: KeyboardMapOptions = {},
): KeyboardAction | null {
  // IME composition safety (#60): Japanese/Chinese/Korean users confirm
  // conversion with Enter / Space and sometimes Escape. `isComposing` is
  // the spec-mandated flag; `keyCode === 229` is the legacy fallback.
  if (event.isComposing || event.keyCode === 229) return null
  // Never hijack keys while the user is typing in a field.
  if (isEditableTarget(event.target)) return null
  // Ignore shortcuts with modifiers to avoid clashing with browser shortcuts.
  if (event.ctrlKey || event.metaKey || event.altKey) return null

  const disabled = new Set(options.disable ?? [])
  const map: Record<KeyboardAction, string[]> = { ...DEFAULT_MAP, ...options.overrides }

  for (const action of Object.keys(map) as KeyboardAction[]) {
    if (disabled.has(action)) continue
    if (map[action].includes(event.key)) return action
  }
  return null
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    const input = target as HTMLInputElement
    return !input.disabled && !input.readOnly
  }
  if ((target as HTMLElement).isContentEditable) return true
  const ce = target.getAttribute("contenteditable")
  if (ce !== null && ce !== "false") return true
  return false
}
