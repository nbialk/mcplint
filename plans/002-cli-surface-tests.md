# Plan 002: Add test coverage for the CLI surface (headers, snapshot, JSON report, e2e smoke)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat be54731..HEAD -- src/cli.ts src/client/fetch.ts src/report/json.ts test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `be54731`, 2026-06-11

## Why this matters

The only test file (`test/deterministic.test.ts`, 21 tests) covers the linter
rules and `parseStdioCommand`. Everything else — HTTP header parsing,
auth-error detection, tool normalization from the wire, the JSON report (which
the README sells as "a stable, machine-readable report suited to CI"), and the
process exit codes — has zero coverage. Any regression in those ships silently
in a published npm CLI. This plan builds the harness that plans 003 and 004
add their regression tests to.

## Current state

- `src/cli.ts` — CLI entry. Two pure helpers are currently **private** (not
  exported) and therefore untestable:
  - `parseHeaders` (`src/cli.ts:63-77`): parses repeatable `"Name: value"`
    strings + `--bearer` into a header map; calls `fail()` (which calls
    `process.exit(2)`) on malformed input.
  - `isAuthError` (`src/cli.ts:166-168`):
    ```ts
    function isAuthError(message: string): boolean {
      return /\b401\b|unauthor|invalid_token|forbidden|\b403\b|authoriz/i.test(message);
    }
    ```
  Note: `src/cli.ts` runs `program.parseAsync()` at module top level
  (`src/cli.ts:175`), so it must NEVER be imported by a test — importing it
  executes the CLI.
- `src/client/fetch.ts` — `fetchSnapshot(client)` (`:14-25`) calls
  `client.getServerVersion()` and `client.listTools()`, then maps tools
  through the private `normalizeTool` (`:27-37`) which coerces non-string
  `name`/`title`/`description` to `""`/`undefined`.
- `src/report/json.ts` — `renderJson(snapshot, findings)` (`:5-18`) returns
  the CI JSON contract: `{ server, toolCount, summary: { errors, warnings,
  info, annotated }, findings }`.
- `test/deterministic.test.ts` — the structural pattern to follow: vitest
  `describe`/`it`, fixtures imported from `test/fixtures.ts`.
- `test/fixtures.ts` — exports `cleanSnapshot`, `brokenSnapshot`,
  `heuristicSnapshot` (`McpSnapshot` objects).
- Conventions: TypeScript strict ESM (`"module": "NodeNext"` — **all relative
  imports need a `.js` extension**), no test framework config file (vitest
  defaults), Conventional Commits.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| All tests | `pnpm test` | all pass |
| One file | `pnpm vitest run test/json.test.ts` | all pass |
| Build | `pnpm build` | exit 0, emits `dist/` |

## Scope

**In scope**:
- `src/cli-helpers.ts` (create — extracted pure helpers)
- `src/cli.ts` (modify — import the extracted helpers; no behavior change)
- `test/cli-helpers.test.ts` (create)
- `test/fetch.test.ts` (create)
- `test/json.test.ts` (create)
- `test/e2e.test.ts` (create)
- `test/fixtures/stdio-server.mjs` (create — minimal MCP server for e2e)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/linter/**`, `src/rules.ts` — already covered.
- `src/client/connect.ts` — transport construction needs a live SDK transport;
  covered indirectly by the e2e smoke test.
- Any change to the JSON output shape — it is a documented CI contract; tests
  must encode the CURRENT shape, not improve it.
- `package.json` scripts/dependencies (exception: none needed — `tsx` and the
  MCP SDK are already installed).

## Git workflow

- Branch: `advisor/002-cli-surface-tests` (or stay on current branch if the
  operator says so).
- Conventional Commits, e.g. `test: cover CLI helpers, snapshot fetch, and json report`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `parseHeaders` and `isAuthError` into `src/cli-helpers.ts`

Create `src/cli-helpers.ts`. Move both functions there **verbatim**, with one
required change: `parseHeaders` must throw instead of calling `fail()` (which
lives in `cli.ts` and exits the process). Target shape:

```ts
/** Parses "Name: value" header strings into a header map. Throws on malformed input. */
export function parseHeaders(
  raw: string[] | undefined,
  bearer?: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const entry of raw ?? []) {
    const idx = entry.indexOf(":");
    if (idx === -1) {
      throw new Error(`Invalid --header "${entry}". Expected format "Name: value".`);
    }
    const name = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (!name) throw new Error(`Invalid --header "${entry}". Header name is empty.`);
    headers[name] = value;
  }
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  return headers;
}

/** Heuristic match for 401/invalid_token style failures across transports. */
export function isAuthError(message: string): boolean {
  return /\b401\b|unauthor|invalid_token|forbidden|\b403\b|authoriz/i.test(message);
}
```

In `src/cli.ts`: delete both function definitions, add
`import { isAuthError, parseHeaders } from "./cli-helpers.js";`, and wrap the
`parseHeaders` call site (`src/cli.ts:92`) so a thrown error still produces
the same UX: catch it and call `fail(err.message)`. Simplest form:

```ts
let headers: Record<string, string>;
try {
  headers = parseHeaders(opts.header, opts.bearer);
} catch (err) {
  fail(errorMessage(err));
}
```

**Verify**: `pnpm typecheck` → exit 0. `pnpm build` → exit 0.

### Step 2: Unit-test the helpers

Create `test/cli-helpers.test.ts` (import from `../src/cli-helpers.js` — NOT
from `../src/cli.js`). Cases:

- `parseHeaders(["X-Api-Key: abc"])` → `{ "X-Api-Key": "abc" }`
- value containing a colon: `["X-A: b:c"]` → `{ "X-A": "b:c" }`
- whitespace trimmed: `["X-A :  v "]` → `{ "X-A": "v" }`
- bearer only: `parseHeaders(undefined, "tok")` → `{ Authorization: "Bearer tok" }`
- bearer overrides an explicit Authorization header (current behavior:
  bearer is applied last and wins)
- throws on `["no-colon"]` and on `[": value"]`
- `isAuthError`: true for `"HTTP 401"`, `"Unauthorized"`, `"invalid_token"`,
  `"403 Forbidden"`; false for `"ECONNREFUSED"`, `"fetch failed"`

**Verify**: `pnpm vitest run test/cli-helpers.test.ts` → all pass.

### Step 3: Test `fetchSnapshot` with a stub client

Create `test/fetch.test.ts`. Build a minimal stub and cast it:

```ts
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { fetchSnapshot } from "../src/client/fetch.js";

function stubClient(tools: unknown[], version?: { name: string; version: string }) {
  return {
    getServerVersion: () => version,
    listTools: async () => ({ tools }),
  } as unknown as Client;
}
```

Cases:

- server name/version flow into `snapshot.server`; absent version → both
  `undefined`
- a well-formed tool maps all six fields through
- non-string `name` (e.g. `{ name: 42 }`) → normalized to `""`
- non-string `title`/`description` → `undefined`
- empty tool list → `snapshot.tools` is `[]`

**Verify**: `pnpm vitest run test/fetch.test.ts` → all pass.

### Step 4: Lock the JSON contract

Create `test/json.test.ts` using `cleanSnapshot` and `brokenSnapshot` from
`test/fixtures.js`. Run findings through `runLinter` first:

- `JSON.parse(renderJson(...))` succeeds
- top-level keys are exactly `["server", "toolCount", "summary", "findings"]`
- `summary` keys are exactly `["errors", "warnings", "info", "annotated"]`
- `toolCount` equals `snapshot.tools.length`
- for `cleanSnapshot`: `summary.errors === 0` and `findings` is `[]`
- every finding object has `ruleId`, `severity`, `toolName`, `message`

**Verify**: `pnpm vitest run test/json.test.ts` → all pass.

### Step 5: e2e smoke test over stdio

Create `test/fixtures/stdio-server.mjs` — a minimal MCP server using the SDK
that registers ONE tool with a description, title, full annotations, and
object input/output schemas (mirror the shape of `cleanSnapshot.tools[0]` in
`test/fixtures.ts:7-26` so the lint result is clean). Skeleton:

```js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "e2e-fixture", version: "1.0.0" });
server.registerTool(
  "search_docs",
  {
    title: "Search Docs",
    description: "Search the documentation for a query.",
    inputSchema: { query: z.string().describe("The search query.") },
    outputSchema: { results: z.array(z.string()).describe("Matching docs.") },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => ({ content: [], structuredContent: { results: [] } }),
);
await server.connect(new StdioServerTransport());
```

(`zod` is available via the SDK's own dependency tree AND as a direct dep at
planning time; if plan 005 has already removed the direct `zod` dependency,
import still resolves through pnpm only if hoisted — to be safe, build the
schemas with plain JSON Schema instead if the import fails; the SDK's
`registerTool` also accepts Zod shapes only, so on failure fall back to the
low-level `Server` class with a `tools/list` handler returning a static tool
object. If that takes more than one attempt, STOP and report.)

Create `test/e2e.test.ts`: spawn the CLI as a subprocess with
`node_modules/.bin/tsx`:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

it("lints a stdio server end to end and exits 0 with --json", async () => {
  const { stdout } = await run("node", [
    "node_modules/.bin/tsx", "src/cli.ts",
    "--stdio", "node test/fixtures/stdio-server.mjs",
    "--json",
  ], { timeout: 30_000 });
  const report = JSON.parse(stdout);
  expect(report.server.name).toBe("e2e-fixture");
  expect(report.toolCount).toBe(1);
  expect(report.summary.errors).toBe(0);
});

it("exits 2 on an unreachable url", async () => {
  await expect(
    run("node", ["node_modules/.bin/tsx", "src/cli.ts", "--url", "http://127.0.0.1:9"], { timeout: 30_000 }),
  ).rejects.toMatchObject({ code: 2 });
});
```

Set a per-file vitest timeout if needed: `describe`-level
`{ timeout: 30_000 }` or `vi.setConfig`.

**Verify**: `pnpm vitest run test/e2e.test.ts` → both pass.

## Test plan

Covered by steps 2–5: ~20 new tests across 4 new files, modeled structurally
on `test/deterministic.test.ts`. Full-suite verification:
`pnpm test` → all pass (21 existing + new).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; test count strictly greater than 21
- [ ] `test/cli-helpers.test.ts`, `test/fetch.test.ts`, `test/json.test.ts`,
      `test/e2e.test.ts` all exist and pass
- [ ] `grep -n "function parseHeaders" src/cli.ts` returns no matches
      (helper extracted)
- [ ] `pnpm build` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/cli.ts` no longer matches the excerpts (drifted).
- The e2e fixture server cannot be made to work after the documented fallback
  (SDK API mismatch) — deliver steps 1–4 as a partial result and report the
  SDK version + error.
- The e2e test is flaky (passes/fails across runs) — report rather than
  adding retries.
- Any test forces a change to production behavior. Tests encode current
  behavior; behavior changes belong to other plans.

## Maintenance notes

- Plans 003 (Ajv `$id` fix) and 004 (pagination) add their regression tests
  to this harness — `test/fetch.test.ts`'s `stubClient` is the pattern plan
  004 extends with a paginating `listTools`.
- Reviewers: check that `src/cli.ts` behavior is unchanged — the extraction
  must be pure refactor (same error message text, same exit code 2).
- Deferred: testing `renderConsole` output formatting (cosmetic, low value)
  and `connect.ts` transport options (would require network/spawn mocking
  beyond smoke-test value).
