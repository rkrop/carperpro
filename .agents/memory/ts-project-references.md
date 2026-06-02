---
name: TS project references vs typecheck
description: Why api-server typecheck sees stale @workspace/db types after a schema edit, and the fix.
---

# api-server typecheck reads lib/db's compiled .d.ts, not source

`artifacts/api-server/tsconfig.json` uses TypeScript **project references**
(`references: [{ path: "../../lib/db" }, ...]`). Under project references, `tsc`
resolves `@workspace/db` to the referenced project's emitted declarations in
`lib/db/dist/*.d.ts` — NOT to `lib/db/src`. The runtime build (esbuild
`build.mjs`) bundles from source via the package `exports` map (`. -> ./src/index.ts`),
so the running app picks up schema edits immediately, but `pnpm --filter
@workspace/api-server run typecheck` will report phantom errors like
`type 'X' and '"newvalue"' have no overlap` because it's reading stale `dist`.

**Why:** `lib/db` has no `build` script and `composite: true`; its `dist` is only
regenerated when you build that project explicitly.

**How to apply:** After editing any `lib/db/src/schema/*` type/enum, rebuild the
declarations before typechecking consumers:
`npx tsc -b lib/db` (or `tsc -b artifacts/api-server` which builds refs first).
Then `pnpm --filter @workspace/api-server run typecheck` passes.
