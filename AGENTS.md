# pencere

Modern, accessible, framework-agnostic lightbox. Pure TypeScript, zero runtime dependencies, ESM, tree-shakeable.

> [!IMPORTANT]
> Keep `AGENTS.md` updated with project status.

## Project Structure

```
src/
  index.ts        # Main API
  types.ts        # Public types
  errors.ts       # Custom error classes
test/
  *.test.ts       # Vitest tests (flat)
.github/workflows/
  ci.yml
  release.yml
```

## Build & Scripts

```bash
pnpm build       # obuild (rolldown)
pnpm dev         # vitest watch
pnpm lint        # oxlint + oxfmt --check
pnpm lint:fix    # oxlint --fix + oxfmt
pnpm fmt         # oxfmt
pnpm test        # lint + typecheck + vitest
pnpm typecheck   # tsgo --noEmit
pnpm release     # test + build
```

## Code Conventions

- Pure ESM — no CJS
- Zero runtime dependencies
- TypeScript strict, `verbatimModuleSyntax`
- Formatter: oxfmt (double quotes, semicolons, 2-space)
- Linter: oxlint
- Tests: vitest in `test/` (flat naming)
- No test left behind — every feature gets a test
- Commits: semantic lowercase (`feat:`, `fix:`, `chore:`, `docs:`)
- Issues: reference in commits (`feat(#N):`)
