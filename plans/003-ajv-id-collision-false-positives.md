# Plan 003: Eliminate Ajv `$id`-collision false positives in schema validation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat be54731..HEAD -- src/linter/deterministic.ts test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (test placement is nicer after plan 002, but not required)
- **Category**: bug
- **Planned at**: commit `be54731`, 2026-06-11

## Why this matters

The linter validates every tool's `inputSchema`/`outputSchema` by compiling it
with a single module-level, cached Ajv instance. Ajv registers every compiled
schema's `$id` in that cache. Consequence: if two tools on a server declare
schemas with the same `$id` (common when servers generate schemas from shared
models), the second `compile()` throws `schema with key or id "..." already
exists` — and mcplint reports a **false** `input-schema-invalid` /
`output-schema-invalid` **error**, failing CI for a server that is fine. This
was reproduced at planning time:

```
node -e: first compile ok; second compile threw:
  schema with key or id "https://example.com/s" already exists
```

A secondary defect in the same function: the `catch` block reads `ajv.errors`,
which Ajv only sets for *meta-schema validation* failures; for cache-collision
throws it holds **stale errors from an earlier failed compile**, producing
misleading messages.

## Current state

- `src/linter/deterministic.ts` — the only file using Ajv:

  ```ts
  // src/linter/deterministic.ts:17-22
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateSchema: true,
    logger: false,
  });

  // src/linter/deterministic.ts:25-36
  function validateSchema(schema: unknown): string | null {
    try {
      ajv.compile(schema as object);
      return null;
    } catch (err) {
      const first = ajv.errors?.[0];
      if (first) {
        return `${first.instancePath || "schema"} ${first.message ?? "is invalid"}`;
      }
      return err instanceof Error ? err.message : "Schema is not a valid JSON Schema.";
    }
  }
  ```

  The doc comment above the instance (`:10-16`) explains why `strict: false`
  and `logger: false` are set — preserve both options and the comment.
- Call sites: `validateSchema(tool.outputSchema)` at `:144` and
  `validateSchema(tool.inputSchema)` at `:161`. No other module imports Ajv.
- Tests live in `test/deterministic.test.ts` with fixtures in
  `test/fixtures.ts` (`brokenSnapshot` exercises `bad_input_schema` with
  `required: "not-an-array"` — that genuine-invalid case must keep failing).
- Conventions: strict TS, NodeNext ESM (`.js` import extensions),
  Conventional Commits.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | all pass |
| One file | `pnpm vitest run test/deterministic.test.ts` | all pass |

## Scope

**In scope**:
- `src/linter/deterministic.ts`
- `test/deterministic.test.ts` (add regression tests)
- `test/fixtures.ts` (add a fixture)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/rules.ts`, `src/model/types.ts` — no new rules or types needed.
- Ajv version/options beyond what's specified — do not enable `strict`, do
  not add formats.
- Performance optimizations (schema caching by content hash etc.) — a fresh
  instance per call is fast enough at lint scale (tens of schemas).

## Git workflow

- Branch: `advisor/003-ajv-id-collision`
- Commit: `fix(linter): avoid false schema errors on duplicate $id`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Use a fresh Ajv instance per validation

In `src/linter/deterministic.ts`, replace the module-level `const ajv = new
Ajv(...)` + `validateSchema` pair with a factory used inside the function, so
no state survives between validations:

```ts
const AJV_OPTIONS = {
  allErrors: true,
  strict: false,
  validateSchema: true,
  logger: false,
} as const;

/** Compiles a schema, returning a readable error message if it is invalid. */
function validateSchema(schema: unknown): string | null {
  // Fresh instance per call: Ajv caches compiled schemas by $id, so a shared
  // instance falsely rejects the second of two schemas sharing an $id, and
  // ajv.errors can hold stale results from a previous compile.
  const ajv = new Ajv(AJV_OPTIONS);
  try {
    ajv.compile(schema as object);
    return null;
  } catch (err) {
    const first = ajv.errors?.[0];
    if (first) {
      return `${first.instancePath || "schema"} ${first.message ?? "is invalid"}`;
    }
    return err instanceof Error ? err.message : "Schema is not a valid JSON Schema.";
  }
}
```

Keep (move/merge as appropriate) the existing explanatory comment from
`:10-16` about `strict: false` / `logger: false`.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → all 21+ existing tests
still pass (especially `flags an invalid inputSchema` and
`flags an invalid outputSchema`).

### Step 2: Add the regression fixture

In `test/fixtures.ts`, add and export a new snapshot:

```ts
/**
 * Two valid tools whose schemas share an $id. A naive shared Ajv instance
 * falsely rejects the second one (regression: plan 003).
 */
export const duplicateIdSnapshot: McpSnapshot = {
  server: { name: "dup-id-server", version: "1.0.0" },
  tools: [
    {
      name: "tool_one",
      title: "Tool One",
      description: "First tool sharing a schema $id.",
      inputSchema: { $id: "https://example.com/shared", type: "object", properties: {} },
      outputSchema: { type: "object" },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: "tool_two",
      title: "Tool Two",
      description: "Second tool sharing the same schema $id.",
      inputSchema: { $id: "https://example.com/shared", type: "object", properties: {} },
      outputSchema: { type: "object" },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
  ],
};
```

(Note: `JsonSchemaObject` has an index signature, so `$id` type-checks.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Add regression tests

In `test/deterministic.test.ts`, new `describe("schema $id handling")`:

- `runLinter(duplicateIdSnapshot)` produces **no** `input-schema-invalid`
  findings (the whole findings array should be `[]` for this fixture).
- Determinism across repeated runs: calling `runLinter(duplicateIdSnapshot)`
  twice in the same process yields identical results (guards against any
  surviving cross-call state).
- The genuine-invalid case still fires: keep using `brokenSnapshot`'s
  `bad_input_schema` — assert it still yields `input-schema-invalid` AND that
  its message mentions `required` or `array` (guards the error-message path
  now that `ajv.errors` is per-call).

**Verify**: `pnpm vitest run test/deterministic.test.ts` → all pass,
including 3 new tests.

## Test plan

See steps 2–3. Pattern: existing `describe` blocks in
`test/deterministic.test.ts` (e.g. `describe("directory mode")` at `:93`).
Full check: `pnpm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, with 3 new tests in `test/deterministic.test.ts`
- [ ] `grep -n "^const ajv" src/linter/deterministic.ts` returns no matches
      (no module-level instance)
- [ ] `runLinter(duplicateIdSnapshot)` returns `[]` (asserted by a test)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `validateSchema` in the live code doesn't match the excerpt (drifted).
- After the fix, any *existing* test fails — particularly the
  invalid-schema tests; that means Ajv behaves differently than the plan
  assumes for your installed version. Report the Ajv version
  (`node -p "require('ajv/package.json').version"`) and the failure.
- You're tempted to instead call `ajv.removeSchema()` after each compile —
  don't; it doesn't clear failed-compile state reliably. The fresh-instance
  approach is the required design.

## Maintenance notes

- If schema validation ever becomes a hot path (thousands of tools), revisit
  with content-keyed caching — but measure first.
- Reviewer focus: confirm the Ajv options object is unchanged
  (`allErrors`, `strict: false`, `validateSchema`, `logger: false`) and the
  explanatory comment survived.
- Related minor issue explicitly deferred: `normalizeTool`
  (`src/client/fetch.ts:33-35`) blind-casts schemas, so a boolean JSON Schema
  reaches `validateSchema` as `object` — current behavior degrades gracefully
  and is out of scope here.
