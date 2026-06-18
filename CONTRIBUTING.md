# Contributing to mcplint

Thanks for your interest in contributing! This document covers the basics for
getting set up and submitting changes.

## Development setup

Requires Node.js `>=18` and [pnpm](https://pnpm.io) (see `packageManager` in
`package.json` for the pinned version).

```bash
pnpm install
pnpm build          # tsc -p tsconfig.json -> dist/cli.js
pnpm dev            # tsx src/cli.ts
```

## Verifying changes

Before opening a pull request, make sure all checks pass — these mirror CI:

```bash
pnpm typecheck
pnpm test
pnpm build
```

When changing a single area, run the relevant test file instead of the full
suite, e.g.:

```bash
pnpm vitest run test/deterministic.test.ts
```

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/)
and [release-please](https://github.com/googleapis/release-please) for automated
releases. Format:

```
<type>(<scope>): <subject>
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. The scope is
optional but encouraged (e.g. `feat(rules):`, `fix(client):`). `feat` and `fix`
commits drive version bumps and changelog entries.

## Releases

Releases are automated. On every push to `main`, release-please opens (or
updates) a release PR that bumps the version and updates `CHANGELOG.md` based on
the Conventional Commits since the last release. Merging that PR creates a Git
tag and GitHub release, which triggers publishing to npm.

Publishing requires an `NPM_TOKEN` repository secret (an npm automation token)
configured under **Settings → Secrets and variables → Actions**.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes with tests where it makes sense.
3. Ensure `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
4. Open a PR against `main` with a clear description of what and why.

## Reporting issues

Use GitHub issues for bugs and feature requests. Include reproduction steps and
your OS/Node version where relevant.
