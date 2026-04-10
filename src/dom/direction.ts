/**
 * Resolve the effective writing direction for the viewer.
 *
 * Explicit `ltr`/`rtl` always wins. `auto` (or `undefined`) walks up
 * from the container looking for a `dir` attribute and, failing that,
 * reads the computed direction of the host document's root element.
 */
export function resolveDirection(
  explicit: "ltr" | "rtl" | "auto" | undefined,
  container: HTMLElement,
): "ltr" | "rtl" {
  if (explicit === "ltr" || explicit === "rtl") return explicit
  let node: Element | null = container
  while (node) {
    const d = node.getAttribute("dir")
    if (d === "ltr" || d === "rtl") return d
    node = node.parentElement
  }
  const doc = container.ownerDocument
  const view = doc.defaultView
  if (view) {
    const computed = view.getComputedStyle(doc.documentElement).direction
    if (computed === "rtl") return "rtl"
  }
  return "ltr"
}
