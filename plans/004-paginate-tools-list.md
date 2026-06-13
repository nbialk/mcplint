# Plan 004: Fetch all `tools/list` pages so large servers are fully linted

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat be54731..HEAD -- src/client/fetch.ts test/fetch.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-cli-surface-tests.md (uses its `stubClient`
  pattern in `test/fetch.test.ts`; if 002 hasn't run, create the file and the
  stub yourself following the shape below)
- **Category**: bug
- **Planned at**: commit `be54731`, 2026-06-11

## Why this matters

The MCP `tools/list` endpoint is paginated: a server may return a page of
tools plus a `nextCursor`, and clients must re-request with that cursor until
it is absent. The SDK's `Client.listTools()` performs exactly **one** request
(verified in `@modelcontextprotocol/sdk/dist/esm/client/index.js`, `listTools`
sends a single `tools/list` and returns the raw result — no cursor loop).
mcplint therefore lints only the first page and reports e.g. "40 tool(s)
checked" with a green summary for a server that actually has 200 tools — a
silent false-clean, the worst failure mode a linter can have.

## Current state

- `src/client/fetch.ts` — the only place tools are fetched:

  ```ts
  // src/client/fetch.ts:14-25
  export async function fetchSnapshot(client: Client): Promise<McpSnapshot> {
    const version = client.getServerVersion();
    const { tools } = await client.listTools();

    return {
      server: {
        name: version?.name,
        version: version?.version,
      },
      tools: tools.map(normalizeTool),
    };
  }
  ```

- The SDK signature is
  `listTools(params?: ListToolsRequest["params"], options?: RequestOptions)`;
  pagination params are `{ cursor?: string }` and the result carries an
  optional `nextCursor: string | undefined`.
- After plan 002, `test/fetch.test.ts` exists with this stub pattern:

  ```ts
  function stubClient(tools: unknown[], version?: { name: string; version: string }) {
    return {
      getServerVersion: () => version,
      listTools: async () => ({ tools }),
    } as unknown as Client;
  }
  ```

- Conventions: strict TS, NodeNext ESM (`.js` import extensions),
  Conventional Commits.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | all pass |
| One file | `pnpm vitest run test/fetch.test.ts` | all pass |

## Scope

**In scope**:
- `src/client/fetch.ts`
- `test/fetch.test.ts` (extend; create if plan 002 hasn't run)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/client/connect.ts`, `src/cli.ts` — the loop lives entirely in
  `fetchSnapshot`.
- Pagination of any other MCP list endpoint (prompts/resources are not
  fetched at all today).
- Progress output / spinners for slow multi-page fetches.

## Git workflow

- Branch: `advisor/004-paginate-tools-list`
- Commit: `fix(client): follow tools/list pagination cursors`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Loop over `nextCursor` in `fetchSnapshot`

Replace the single `listTools()` call with a cursor loop, including a
defense against servers that return a non-advancing cursor (would otherwise
loop forever):

```ts
export async function fetchSnapshot(client: Client): Promise<McpSnapshot> {
  const version = client.getServerVersion();

  const tools: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
    if (cursor !== undefined) {
      if (seenCursors.has(cursor)) {
        throw new Error(
          "Server returned a repeating tools/list cursor; aborting pagination.",
        );
      }
      seenCursors.add(cursor);
    }
  } while (cursor !== undefined);

  return {
    server: {
      name: version?.name,
      version: version?.version,
    },
    tools: tools.map(normalizeTool),
  };
}
```

Adjust the `tools` element type if the SDK's `page.tools` type requires it
(e.g. use the SDK `Tool` type or `unknown[]` and keep the existing
`normalizeTool(tool: Record<string, unknown>)` signature happy with a cast at
the `map` call: `tools.map((t) => normalizeTool(t as Record<string, unknown>))`).
Prefer whatever satisfies `pnpm typecheck` with the fewest casts.

Note: the thrown error surfaces through the existing handler in
`src/cli.ts:125-127` as `Failed during analysis: ...` with exit code 2 —
that is the intended behavior, no CLI change needed.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → existing tests pass
(the e2e smoke from plan 002 proves the single-page path still works).

### Step 2: Add pagination tests

In `test/fetch.test.ts`, add a paginating stub:

```ts
function pagedStubClient(pages: { tools: unknown[]; nextCursor?: string }[]) {
  const calls: (string | undefined)[] = [];
  let i = 0;
  const client = {
    getServerVersion: () => undefined,
    listTools: async (params?: { cursor?: string }) => {
      calls.push(params?.cursor);
      return pages[Math.min(i++, pages.length - 1)];
    },
  } as unknown as Client;
  return { client, calls };
}
```

Cases:

1. Two pages (`nextCursor: "c1"` then none) → snapshot contains tools from
   BOTH pages, in order; `calls` equals `[undefined, "c1"]`.
2. Single page without `nextCursor` → exactly one call.
3. Repeating cursor (every page returns `nextCursor: "stuck"`) →
   `fetchSnapshot` rejects with a message matching `/repeating.*cursor/i`.

**Verify**: `pnpm vitest run test/fetch.test.ts` → all pass, including 3 new
tests.

## Test plan

See step 2; model on the existing `test/fetch.test.ts` structure from plan
002 (or `test/deterministic.test.ts` if creating fresh). Full check:
`pnpm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, with 3 new pagination tests
- [ ] `grep -n "nextCursor" src/client/fetch.ts` shows the loop exists
- [ ] Multi-page stub test asserts tools from both pages appear in the snapshot
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `fetchSnapshot` no longer matches the excerpt (drifted).
- The installed SDK's `listTools` signature rejects `{ cursor }` params at
  typecheck — report the SDK version
  (`node -p "require('@modelcontextprotocol/sdk/package.json').version"`)
  and the type error instead of casting around it.
- You find yourself wanting to add a max-page cap, config option, or progress
  UI — out of scope; the repeating-cursor guard is the only safety mechanism
  this plan adds.

## Maintenance notes

- When prompts/resources linting is added (direction finding D2), reuse this
  cursor-loop shape for `listPrompts`/`listResources` — consider extracting a
  generic `paginate()` helper at that point, not before.
- Reviewer focus: cursor loop terminates on `undefined` only — an empty-string
  cursor is technically a value; the `seenCursors` guard catches a server
  that loops on it.
