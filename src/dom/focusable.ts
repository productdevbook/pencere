/**
 * Selector matching elements that are sequentially focusable by default.
 * See HTML spec §6.6.3 ("focusable area") and CSS :focus-visible.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Return the tabbable descendants of `root` in document order.
 *
 * Skips elements that are:
 * - `disabled`
 * - `tabindex="-1"`
 * - `hidden` or with `display: none` / `visibility: hidden`
 * - inside an `inert` ancestor
 *
 * Note: this does NOT currently descend into open shadow roots;
 * that is tracked by a follow-up task.
 */
export function getTabbable(root: ParentNode): HTMLElement[] {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter(isTabbable);
}

export function isTabbable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.tabIndex < 0) return false;
  if (el.hidden) return false;
  // `inert` short-circuits focus for the whole subtree.
  const inertAncestor = el.closest("[inert]");
  if (inertAncestor) return false;
  // jsdom does not fully implement getComputedStyle(display) reliability,
  // but `offsetParent === null` is a decent proxy for hidden elements in
  // most browser and jsdom configurations.
  if (el.offsetParent === null && el.tagName !== "BODY") {
    // Elements that are position:fixed can legitimately have offsetParent null.
    const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  }
  return true;
}

export function firstTabbable(root: ParentNode): HTMLElement | null {
  return getTabbable(root)[0] ?? null;
}

export function lastTabbable(root: ParentNode): HTMLElement | null {
  const list = getTabbable(root);
  return list[list.length - 1] ?? null;
}
