/**
 * Security primitives shared across the library.
 *
 * These helpers are pure, SSR-safe, and DOM-free so they can be unit-tested
 * without a browser environment.
 */

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "data:", "blob:", "mailto:", "tel:"]);

/**
 * Validate a URL against an allowlist of safe protocols.
 *
 * Rejects `javascript:`, `vbscript:`, `file:`, and any other
 * non-allowlisted scheme. Accepts absolute URLs and — when `base`
 * is provided — relative URLs resolved against `base`.
 *
 * Returns the normalized href on success, or `null` if the URL is
 * unparseable or uses a forbidden protocol.
 */
export function safeUrl(input: string, base?: string): string | null {
  if (typeof input !== "string" || input.length === 0) return null;
  // Trim leading/trailing control chars per WHATWG URL parser rules;
  // attackers often use \t\n\r to hide javascript: schemes.
  const cleaned = input.replace(/[\t\n\r]/g, "").trim();
  if (cleaned.length === 0) return null;
  let url: URL;
  try {
    url = base === undefined ? new URL(cleaned) : new URL(cleaned, base);
  } catch {
    return null;
  }
  if (!SAFE_URL_PROTOCOLS.has(url.protocol)) return null;
  return url.href;
}

/**
 * Escape characters that would change HTML semantics when rendered
 * via `innerHTML`. Prefer `element.textContent = s` where possible;
 * this helper exists for the handful of paths that must build a
 * string (e.g. server-rendered markup, shadow DOM templates).
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Assert that a string does not carry a dangerous protocol even
 * when used as a user-visible link target. Returns `true` when safe.
 */
export function isSafeUrl(input: string, base?: string): boolean {
  return safeUrl(input, base) !== null;
}
