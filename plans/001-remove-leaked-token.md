# Plan 001: Remove the credential-bearing scratch file and prevent recurrence

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat be54731..HEAD -- .gitignore`
> If `.gitignore` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `be54731`, 2026-06-11

## Why this matters

The untracked scratch file `mcp.tests.txt` in the repo root contains a
real-looking PostHog API token (type `phx_…`, at `mcp.tests.txt:7`) alongside
manual test commands. The file is one `git add .` away from being committed and
published to a public GitHub repo. Untracked files are also routinely swept up
by tooling, backups, and agents. The value must never appear in git history,
in this plan, or in any other file.

**IMPORTANT — never copy the token value anywhere.** Refer to it only as "the
PostHog token in `mcp.tests.txt:7`".

## Current state

- `mcp.tests.txt` — repo root, **untracked** (shows as `??` in `git status`).
  Contains 4 manual test invocations for MCP servers (Sentry, PostHog, Chess,
  AI Studio); the PostHog entry on line 7 embeds a bearer token inline.
- `.gitignore` — does not currently ignore scratch/notes files. Current
  content (`.gitignore:1-22` at planning time):

  ```
  node_modules/
  dist/

  # Generated agent provider files (source of truth: .agents/)
  .claude/
  .opencode/
  .codex/
  .mcp.json
  opencode.json

  *.log
  .DS_Store
  .env
  .env.*
  ```

  (plus a few more generated-file entries; verify against the live file).
- Confirm before starting that the token is **not** in git history:
  `git log --all --oneline -- mcp.tests.txt` must return nothing.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Confirm untracked | `git status --short mcp.tests.txt` | `?? mcp.tests.txt` |
| Confirm no history | `git log --all --oneline -- mcp.tests.txt` | empty output |
| Typecheck (sanity) | `pnpm typecheck` | exit 0 |

## Scope

**In scope** (the only files you may modify/delete):
- `mcp.tests.txt` (delete)
- `.gitignore` (append entries)
- `plans/README.md` (status row)

**Out of scope**:
- Everything else. This plan changes no source code.
- Rotating the PostHog token — an executor cannot do this; it requires the
  maintainer's PostHog account. See "Maintenance notes".

## Git workflow

- Work directly on the current branch (the file is untracked; deleting it is
  not a git operation). The `.gitignore` change is the only commit-worthy edit.
- Commit message style (Conventional Commits, matching `git log`):
  `chore: ignore local scratch files`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Verify the token never entered git history

Run `git log --all --oneline -- mcp.tests.txt`.

**Verify**: empty output. If ANY commit is listed, STOP (see STOP conditions —
history rewriting is out of scope for an executor).

### Step 2: Delete the scratch file

Delete `mcp.tests.txt` from the repo root. Do not open, quote, or copy its
contents anywhere first.

**Verify**: `git status --short mcp.tests.txt` → empty output, and
`ls mcp.tests.txt` → "No such file or directory".

### Step 3: Add ignore rules for local scratch files

Append to `.gitignore`:

```
# Local scratch / notes (may contain credentials)
*.local.txt
mcp.tests.txt
```

**Verify**: `git check-ignore -v mcp.tests.txt` → prints the `.gitignore` rule
that matches (exit 0).

## Test plan

No code changes; no tests. The verification commands above are the test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `ls mcp.tests.txt` fails (file gone)
- [ ] `git check-ignore mcp.tests.txt` exits 0
- [ ] `git log --all --oneline -- mcp.tests.txt` outputs nothing
- [ ] `git status --short` shows only `.gitignore` (and plans/) modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 shows the file in ANY commit — then the token is burned in history
  and the maintainer must rotate it AND rewrite/force-push or treat the repo
  as compromised. That decision is not the executor's to make.
- `mcp.tests.txt` no longer exists when you start (already handled — just do
  Step 3 and report).
- You find additional files containing credential-like strings while working —
  report their paths (NOT their contents).

## Maintenance notes

- **The maintainer must rotate the PostHog token regardless** of this plan's
  outcome: it has been sitting in plaintext on disk and has appeared in agent
  session contexts. Rotate it in the PostHog project settings, then update
  whatever local secret store the manual test commands read from.
- Recommendation for the future: keep manual test invocations in a
  `*.local.txt` file (now gitignored) with placeholders like `$POSTHOG_TOKEN`,
  and export real values from a shell secret manager.
