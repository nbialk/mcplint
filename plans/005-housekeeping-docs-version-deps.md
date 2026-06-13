# Plan 005: Housekeeping — sync README with the CLI, single-source the version, drop dead deps/scripts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat be54731..HEAD -- README.md package.json src/cli.ts src/client/connect.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. NOTE for the operator: if plan 002 runs after this
  one, its e2e fixture must not rely on a direct `zod` dependency (plan 002
  already documents that fallback).
- **Category**: docs / tech-debt
- **Planned at**: commit `be54731`, 2026-06-11

## Why this matters

Three small drifts in a published npm package: (1) the README omits two
shipped CLI flags (`--directory`, `--experimental`), the two heuristic rules,
and the current JSON summary fields — users discover features only via
`--help`; (2) the version string `"1.0.0"` is hardcoded in two source files
and will silently lie after the next `package.json` bump; (3) `zod` is a
direct dependency with zero imports in `src/` (it weighs on every `npx`
install), and two npm scripts point at a file that no longer exists.

## Current state

- `package.json`:
  - `:43-44` — scripts pointing at a **nonexistent** file (no `scripts/`
    directory exists in the repo; leftover from the quiver-cli migration in
    commit `be54731`):
    ```json
    "agents:sync": "node scripts/agents/sync-agent-shims.mjs",
    "agents:check": "node scripts/agents/sync-agent-shims.mjs --check",
    ```
  - `:53` — `"zod": "^3.25.0"` under `dependencies`. Verified unused:
    `grep -rn "zod" src/` returns nothing. (The MCP SDK depends on zod
    itself — that stays, it's the SDK's own dependency.)
  - `:3` — `"version": "1.0.0"`.
- `src/cli.ts:27` — `.version("1.0.0")` hardcoded.
- `src/client/connect.ts:10` —
  `const CLIENT_INFO = { name: "mcplint", version: "1.0.0" };` hardcoded.
- `README.md`:
  - Options table (`:72-82`) lists `--url, --stdio, --header, --bearer,
    --verbose, --debug, --json, --version, --help` — missing `--directory`
    and `--experimental` (added in commit `506a4bd`; see
    `src/cli.ts:37-44` for their exact help texts).
  - Rules table (`:101-116`) lists 14 rules — missing the two heuristic
    rules from `src/rules.ts:91-102` (`tool-likely-readonly-unannotated`,
    `tool-likely-mutating-unannotated`, both severity `info`, opt-in via
    `--experimental`). Also doesn't mention that `hint-readonly-missing` and
    `hint-destructive-missing` become **errors** under `--directory`
    (see `directoryError: true` in `src/rules.ts:40,47`).
  - JSON example (`:132-139`) shows
    `"summary": { "errors": 0, "warnings": 6 }` — the real shape from
    `src/report/json.ts:12` is
    `summary: { errors, warnings, info, annotated }` where `annotated` is
    `{ full, total }`.
- tsconfig (`tsconfig.json`): `"rootDir": "src"`, `"outDir": "dist"` — so
  `package.json` can NOT be `import`ed from `src/` without breaking rootDir;
  use `createRequire` (step 2). Both `src/cli.ts` (via tsx) and the built
  `dist/cli.js` sit exactly one directory below the repo root, so the
  relative path `../package.json` resolves correctly in both modes.
- Conventions: strict TS, NodeNext ESM (`.js` import extensions),
  Conventional Commits.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install (after dep change) | `pnpm install` | exit 0, lockfile updated |
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | all pass |
| Build | `pnpm build` | exit 0 |
| Smoke version (dev) | `pnpm dev --version` | prints `1.0.0` |
| Smoke version (built) | `node dist/cli.js --version` | prints `1.0.0` |

## Scope

**In scope**:
- `README.md`
- `package.json` + `pnpm-lock.yaml` (via `pnpm install` only)
- `src/version.ts` (create)
- `src/cli.ts` (version line only)
- `src/client/connect.ts` (CLIENT_INFO only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any rule logic, report logic, or CLI flag behavior.
- The `.agents/` directory and `quiver.lock` — agent tooling config, not
  source.
- Other README sections (Vision & scope, Layer descriptions) — content
  decisions belong to the maintainer.
- Removing `zod` from `pnpm-lock.yaml` by hand — only ever via `pnpm install`.

## Git workflow

- Branch: `advisor/005-housekeeping`
- Suggested commits (one per logical unit, Conventional Commits):
  - `docs: document --directory, --experimental, heuristic rules, json shape`
  - `refactor: single-source the version from package.json`
  - `chore: drop unused zod dependency and stale agent scripts`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Sync the README

1. Add to the Options table (match existing table style, `README.md:72-82`):
   - `--directory` — "Directory-submission mode: missing readOnly/destructive hints become errors."
   - `--experimental` — "Enable opt-in heuristic checks (name-based read/write inference)."
2. Add both heuristic rules to the rules table with severity `info` and a
   sentence after the table: heuristic rules only run with `--experimental`
   and never affect the exit code.
3. After the rules table, add one sentence: with `--directory`,
   `hint-readonly-missing` and `hint-destructive-missing` are reported as
   errors instead of warnings.
4. Fix the JSON example to the real shape:
   ```json
   {
     "server": { "name": "example", "version": "0.0.1" },
     "toolCount": 3,
     "summary": {
       "errors": 0,
       "warnings": 6,
       "info": 0,
       "annotated": { "full": 1, "total": 3 }
     },
     "findings": [ ... ]
   }
   ```

**Verify**: `grep -c "directory\|experimental" README.md` → ≥ 4 (table rows +
prose). Manual read of the diff: only the four edits above.

### Step 2: Single-source the version

Create `src/version.ts`:

```ts
import { createRequire } from "node:module";

// package.json sits one level above both src/ (dev via tsx) and dist/
// (built output), so this resolves identically in both modes. createRequire
// is used because rootDir excludes package.json from the TS program.
const pkg = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

export const VERSION: string = pkg.version;
```

- `src/cli.ts:27`: replace `.version("1.0.0")` with `.version(VERSION)` and
  add `import { VERSION } from "./version.js";`.
- `src/client/connect.ts:10`: replace with
  `const CLIENT_INFO = { name: "mcplint", version: VERSION };` and add
  `import { VERSION } from "../version.js";`.

**Verify**:
- `pnpm typecheck` → exit 0
- `pnpm build && node dist/cli.js --version` → prints `1.0.0`
- `pnpm dev --version` → prints `1.0.0`
- `grep -rn '"1\.0\.0"' src/` → no matches

### Step 3: Drop the dead dependency and stale scripts

1. In `package.json`, delete the `"zod"` line from `dependencies` and the
   `"agents:sync"` / `"agents:check"` script entries.
2. Run `pnpm install` to update the lockfile.

**Verify**:
- `pnpm typecheck && pnpm test && pnpm build` → all exit 0
- `node -p "Object.keys(require('./package.json').dependencies).join()"` →
  `@modelcontextprotocol/sdk,ajv,commander,picocolors`
- `node dist/cli.js --help` → prints usage (CLI still functions)

## Test plan

No new tests required: step 2 is covered by the `--version` smoke commands,
and (if plan 002 already landed) the e2e suite re-verifies the CLI end to
end via `pnpm test`. If plan 002 has NOT landed, the smoke commands above are
the verification.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0
- [ ] `node dist/cli.js --version` prints the version from `package.json`
- [ ] `grep -rn '"1\.0\.0"' src/` returns no matches
- [ ] `grep -n "zod\|agents:" package.json` returns no matches
- [ ] README documents `--directory`, `--experimental`, both heuristic rules,
      and the 4-field JSON `summary`
- [ ] No files outside the in-scope list modified (`git status` — the
      lockfile change from `pnpm install` is expected)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm test` fails after removing `zod` — something imports it after all
  (likely a test fixture added by plan 002; if so, leave `zod` in place,
  finish the other steps, and report).
- `node dist/cli.js --version` errors after step 2 — the `../package.json`
  resolution assumption is wrong for this layout; report rather than
  switching to a build-time replacement scheme.
- The README sections at the cited line ranges have been restructured
  (drifted) — report instead of guessing where the content moved.

## Maintenance notes

- Release flow note: `version` now flows from `package.json` at runtime —
  bumping the version for a release is a one-line change, and
  `npm version patch|minor|major` works as expected.
- `"files": ["dist"]` in `package.json` means the published tarball's
  `dist/cli.js` resolves `../package.json` to the package root — correct in
  the installed layout too (verified reasoning: `node_modules/@nbialk/mcplint/dist/cli.js`
  → `node_modules/@nbialk/mcplint/package.json`). A reviewer should sanity-
  check with `npm pack --dry-run` if paranoid.
- Deferred: documenting the `--directory` exit-code interplay in the "Exit
  codes" README section (it already follows from "errors → exit 1").
