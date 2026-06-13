# Plan 006: Upgrade vitest to v4 to clear the critical audit advisory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat be54731..HEAD -- package.json pnpm-lock.yaml test/`
> If `package.json`'s devDependencies changed since this plan was written,
> check whether vitest was already upgraded; if it's already `>=4`, mark this
> plan DONE-by-drift in `plans/README.md` and stop.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: MED (major-version bump of the test runner; mitigated by the
  small suite)
- **Depends on**: plans/002-cli-surface-tests.md and
  plans/003-ajv-id-collision-false-positives.md and
  plans/004-paginate-tools-list.md should land FIRST so the upgraded runner
  is validated against the full suite, not just 21 tests.
- **Category**: migration
- **Planned at**: commit `be54731`, 2026-06-11

## Why this matters

`pnpm audit` reports (at planning time):

- **critical** — vitest: "When Vitest UI server is listening, arbitrary file
  can be read and executed" (path: `. > vitest@2.1.9`)
- moderate — vite path traversal (`vitest@2.1.9 > vite@5.4.21`)
- moderate — esbuild dev-server request forwarding (`vite@5.4.21 > esbuild@0.21.5`)

Honest framing: these are **dev-only** dependencies; this repo never runs the
Vitest UI server or a vite dev server, so real-world exploitability here is
low. The costs being paid are (a) a permanently red `pnpm audit` that trains
everyone to ignore it, and (b) two-majors drift on the test runner (2.1.9 →
4.1.8 latest at planning time), which compounds with every new test written.

## Current state

- `package.json:55-60` devDependencies:
  ```json
  "@types/node": "^22.12.0",
  "tsx": "^4.19.0",
  "typescript": "^5.6.0",
  "vitest": "^2.1.0"
  ```
- There is **no** `vitest.config.*` and no `test`/`vitest` key in
  `package.json` other than the script `"test": "vitest run"` — the project
  runs entirely on vitest defaults. This makes the major upgrade low-friction:
  no config to migrate.
- Test files at planning time: `test/deterministic.test.ts` (21 tests).
  After plans 002–004: also `test/cli-helpers.test.ts`, `test/fetch.test.ts`,
  `test/json.test.ts`, `test/e2e.test.ts`, fixture
  `test/fixtures/stdio-server.mjs`.
- Tests use only `describe` / `it` / `expect` imported from `"vitest"`, plus
  (plan 002) `node:child_process` spawning — no mocks, no timers, no snapshot
  files. Nothing known-deprecated in vitest 3/4 is in use.
- CI (`.github/workflows/ci.yml`) runs `pnpm test` on Node 18/20/22.
  **Caution**: vitest 3 requires Node ≥18.12; vitest 4 requires Node ≥20.
  The CI matrix includes Node 18 and `package.json` declares
  `"engines": { "node": ">=18" }` — see step 3.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Upgrade | `pnpm add -D vitest@^4` | exit 0 |
| Install check | `pnpm install --frozen-lockfile` | exit 0 (CI parity) |
| Tests | `pnpm test` | all pass |
| Audit | `pnpm audit` | no critical advisories |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- `package.json` (devDependencies `vitest`; possibly `engines.node`; possibly
  `@types/node` if vitest 4 needs newer types)
- `pnpm-lock.yaml` (via pnpm only)
- `.github/workflows/ci.yml` (Node matrix only, step 3)
- `test/**` (only if a vitest-4 API change forces a mechanical fix)
- `README.md` ("Requirements" section, only if engines change)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/**` — a test-runner upgrade must not change production code.
- Other dependency upgrades (`commander`, `typescript`, `zod` removal etc.) —
  handled elsewhere or deliberately deferred.
- Adding a vitest config file "while you're at it" — defaults are working.

## Git workflow

- Branch: `advisor/006-upgrade-vitest`
- Commits, Conventional Commits style:
  - `chore(deps): upgrade vitest to v4`
  - `ci: drop Node 18 from matrix (vitest 4 requires >=20)` (only if step 3
    applies)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Decide the target major based on Node support

Check vitest 4's minimum Node version:
`pnpm view vitest@latest engines.node` (expect something like `^20.0.0 || >=22.0.0`).

- If the operator wants to keep supporting Node 18 (current
  `engines: >=18`): target **vitest 3** instead
  (`pnpm view vitest@3 engines.node` — vitest 3 supports Node 18.12+), which
  still clears the critical advisory. Record the choice in the final report.
- Default (no operator instruction): target **vitest 4** and bump the
  supported Node floor (step 3). Rationale: Node 18 has been EOL since
  2025-04; the engines field is advisory for a dev-time test runner anyway —
  but keep the published package's `engines` honest (see STOP conditions).

### Step 2: Upgrade and run the suite

```
pnpm add -D vitest@^4        # or vitest@^3 per step 1
pnpm test
```

If tests fail, fix ONLY mechanical breakages in `test/**` (changed import
paths or renamed options). Expected: zero changes needed given the API
surface in use.

**Verify**: `pnpm test` → all pass; `pnpm typecheck` → exit 0;
`pnpm audit 2>&1 | tail -3` → no `critical` line.

### Step 3: Align the CI matrix and engines (vitest 4 path only)

If vitest 4 was chosen:

1. `.github/workflows/ci.yml`: change `node-version: [18, 20, 22]` to
   `[20, 22, 24]`.
2. **Decision point on `engines`:** vitest is a devDependency, so the
   *published package* can still run on Node 18 — the `engines` field in
   `package.json` describes the runtime requirement of the CLI, not the dev
   toolchain. The MCP SDK's own engines floor is the real constraint:
   check `node -p "require('@modelcontextprotocol/sdk/package.json').engines?.node"`.
   - If the SDK requires ≥20, ALSO bump `package.json` `engines.node` to
     `">=20"` and update `README.md` "Requirements" (`README.md:158-160`).
   - If the SDK allows 18, leave `engines` at `">=18"` and only change CI to
     stop *testing* on a Node version the dev toolchain no longer supports —
     note this asymmetry in the commit message.

**Verify**: CI file edited; `pnpm install --frozen-lockfile && pnpm test` →
green locally.

## Test plan

The entire existing suite IS the test plan — this change must be invisible:
`pnpm test` passes with the same test counts as before the upgrade.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node -p "require('vitest/package.json').version"` starts with `4.`
      (or `3.` if the Node-18 path was chosen — record which in the index)
- [ ] `pnpm test` exits 0 with the same number of passing tests as before
- [ ] `pnpm audit` reports no critical advisories
- [ ] `pnpm typecheck` and `pnpm build` exit 0
- [ ] No `src/**` file modified (`git status`)
- [ ] `plans/README.md` status row updated (including the chosen major)

## STOP conditions

Stop and report back (do not improvise) if:

- More than ~3 test files need non-mechanical changes (behavioral rewrites) —
  the "defaults-only, plain API" assumption is wrong.
- The audit still reports a critical advisory after the bump — the advisory
  surface moved; report the new `pnpm audit` output.
- Step 3's SDK engines check requires dropping Node 18 support for the
  *published CLI* and the operator hasn't approved an engines bump — engines
  is a public compatibility promise; report and let the maintainer decide.

## Maintenance notes

- Future dependency-major upgrades deliberately deferred (re-audit later, low
  urgency): `commander` 12→15 (API churn risk in option parsing),
  `typescript` 5→6, `@types/node`. None has a security driver today.
- Reviewer focus: the lockfile diff should show vitest/vite/esbuild moving
  and nothing in the production dependency graph changing.
