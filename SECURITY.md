# Security Policy

## Supported Versions

The latest `0.x` release on npm is the only supported version during
the pre-1.0 phase. Older tags are archival and will not receive fixes.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately via
**GitHub Security Advisories** on this repository:
`https://github.com/productdevbook/pencere/security/advisories/new`

- Do **not** open a public issue for anything you suspect is a
  vulnerability.
- Include a clear reproduction (code, input, browser, steps).
- If applicable, mention the CVSS vector you believe applies.

You can expect an initial response within 5 working days. Fixes
for confirmed issues are shipped within a 90-day disclosure window
unless actively exploited, in which case the window may be shorter.

## Security Stance

- **Zero runtime dependencies** — the smaller the surface, the less
  can go wrong. Framework adapters are optional peer dependencies.
- **URL protocol allowlist** — every `src` / `href` the library
  generates passes through `safeUrl()`, which rejects `javascript:`,
  `vbscript:`, and `file:` (including whitespace-smuggled variants).
- **textContent by default** — captions are set via `textContent`
  so a malicious caption cannot inject HTML.
- **CSP-friendly** — the library does not inject inline `<script>`
  or `<style>` elements. Set `style-src 'self'` and `script-src 'self'`
  with a nonce if you need to supply one.
- **Referrer policy** — created `<img>` elements default to
  `referrerpolicy="strict-origin-when-cross-origin"` so image CDNs
  cannot see full URLs that may contain tokens.
- **Provenance** — npm releases are published with
  `--provenance` from GitHub Actions.
