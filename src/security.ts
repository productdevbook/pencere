/**
 * Security primitives shared across the library.
 *
 * These helpers are pure, SSR-safe, and DOM-free so they can be unit-tested
 * without a browser environment.
 */

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "blob:", "mailto:", "tel:"])
/**
 * `data:` URIs with an image MIME type are the only form of data URI
 * we permit. Everything else is rejected because `data:text/html,…`
 * can smuggle script payloads into any renderer that treats the
 * return value as an `<iframe src>` or anchor `href`.
 */
const SAFE_DATA_MIME = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i

/**
 * Validate a URL against an allowlist of safe protocols.
 *
 * Rejects `javascript:`, `vbscript:`, `file:`, non-image `data:`,
 * and any other non-allowlisted scheme. Accepts absolute URLs and —
 * when `base` is provided — relative URLs resolved against `base`.
 *
 * Returns the normalized href on success, or `null` if the URL is
 * unparseable or uses a forbidden protocol.
 */
export function safeUrl(input: string, base?: string): string | null {
  if (typeof input !== "string" || input.length === 0) return null
  // Trim leading/trailing control chars per WHATWG URL parser rules;
  // attackers often use \t\n\r to hide javascript: schemes.
  const cleaned = input.replace(/[\t\n\r]/g, "").trim()
  if (cleaned.length === 0) return null
  let url: URL
  try {
    url = base === undefined ? new URL(cleaned) : new URL(cleaned, base)
  } catch {
    return null
  }
  // `data:` is only allowed for image MIME types. `data:text/html,…`
  // and friends are rejected — they would otherwise trivially smuggle
  // script payloads into `<iframe src>` consumers.
  if (url.protocol === "data:") {
    return SAFE_DATA_MIME.test(cleaned) ? url.href : null
  }
  if (!SAFE_URL_PROTOCOLS.has(url.protocol)) return null
  return url.href
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
    .replace(/'/g, "&#39;")
}

/**
 * Assert that a string does not carry a dangerous protocol even
 * when used as a user-visible link target. Returns `true` when safe.
 */
export function isSafeUrl(input: string, base?: string): boolean {
  return safeUrl(input, base) !== null
}

/**
 * Minimal shape of a Trusted Types policy object — just enough for
 * the HTML caption sink. We intentionally do not depend on
 * `@types/trusted-types`; the real browser objects are structurally
 * compatible with this interface.
 */
export interface PencereTrustedTypePolicy {
  createHTML(input: string): string | TrustedHTML
}

interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: { createHTML?: (input: string) => string },
  ): PencereTrustedTypePolicy
}
interface TrustedTypesWindow {
  trustedTypes?: TrustedTypePolicyFactory
}

let cachedPolicy: PencereTrustedTypePolicy | null = null

/**
 * Create (and memoize) the `pencere` Trusted Types policy.
 *
 * Callers who opt into HTML captions are expected to supply a
 * sanitizer — typically `DOMPurify.sanitize` — that returns a string.
 * Under `require-trusted-types-for 'script'`, every `innerHTML`-like
 * sink in pencere (currently only HTML captions) is routed through
 * this policy so the sanitized output carries a `TrustedHTML` stamp.
 *
 * When Trusted Types is not exposed on the current window (Firefox,
 * older Safari), returns a no-op shim that passes the string through
 * unchanged — the caller's sanitizer is still the source of truth.
 *
 * Repeated calls with compatible options reuse the same policy object
 * to avoid the "Policy pencere already exists" CSP violation.
 *
 * @example
 * ```ts
 * import DOMPurify from "dompurify"
 * import { createTrustedTypesPolicy } from "pencere"
 *
 * const policy = createTrustedTypesPolicy({
 *   sanitize: (html) => DOMPurify.sanitize(html),
 * })
 * element.innerHTML = policy.createHTML(userHtml) as string
 * ```
 */
export function createTrustedTypesPolicy(
  options: {
    /** User-supplied HTML sanitizer. Defaults to identity (unsafe!). */
    sanitize?: (html: string) => string
    /** Policy name. Defaults to `"pencere"` to match the CSP cookbook. */
    name?: string
  } = {},
): PencereTrustedTypePolicy {
  if (cachedPolicy) return cachedPolicy
  const sanitize = options.sanitize ?? ((s) => s)
  const name = options.name ?? "pencere"

  const win = (typeof window !== "undefined" ? window : globalThis) as TrustedTypesWindow
  const tt = win.trustedTypes
  if (tt && typeof tt.createPolicy === "function") {
    try {
      cachedPolicy = tt.createPolicy(name, { createHTML: sanitize })
      return cachedPolicy
    } catch {
      // Browser refused (e.g. policy of that name already exists and
      // the allowlist disallows duplicates). Fall through to shim.
    }
  }
  cachedPolicy = {
    createHTML(input: string): string {
      return sanitize(input)
    },
  }
  return cachedPolicy
}

/** Visible for tests — reset the memoized policy between cases. */
export function _resetTrustedTypesPolicy(): void {
  cachedPolicy = null
}
