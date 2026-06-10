# mcplint

A CLI tool that connects to a Model Context Protocol (MCP) server and lints its
tool definitions. Think of it as ESLint for MCP tools: it connects, reads the
server's `tools/list`, and reports structure and metadata issues so server
authors can keep their tool definitions clean and convention-compliant.

## Vision & scope

`mcplint` aims to be the **open, CI-friendly pre-flight linter for MCP servers and MCP Apps** — the checks you can run yourself, on every commit, before you ever submit to a store. App readiness breaks down into three layers, and this project deliberately scopes itself to the first two.

**Layer 1 — Static checks (in scope, available today).** Issues found purely from the manifest and tool/resource definitions: missing tool or parameter descriptions, invalid or incomplete schemas, naming conventions, missing hints, missing `outputSchema`. Fast, deterministic, no runtime required. This is the current core of the tool (see [What it checks](#what-it-checks)).

**Layer 2 — Local behavioral & security checks (in scope, planned).** Verify actual behavior without any external account or platform:

- CSP headers on the served view HTML
- `ext-apps` protocol conformance
- Whether the iframe view actually loads
- Whether `structuredContent` matches its declared schema
- Rendering the view in a headless browser against a local MCP Apps emulator

This is where the project adds the most value: shippable by a small team, runnable in CI, and honestly delimited.

**Layer 3 — Live store-submission audits (out of scope).** Launching your app inside *real* ChatGPT and Claude.ai sessions, capturing screenshots, and checking against the current — and partly non-public — acceptance criteria of the Connector Directory / app stores. These rules are a moving, partly private target; chasing them open-source means an endless maintenance treadmill against whoever knows the rules first. We intentionally leave this to hosted services such as [Alpic Beacon](https://docs.alpic.ai/testing/beacon). **For the final store submit, use Beacon/Alpic.**

In short: `mcplint` owns Layers 1 and 2 in the open and points you to a hosted audit for Layer 3.

## Installation

Run it without installing via `npx`:

```bash
npx @nbialk/mcplint --url <url>
```

Or install it globally:

```bash
npm install -g @nbialk/mcplint
mcplint --url <url>
```

### From source

```bash
pnpm install
pnpm build
```

This builds the CLI to `dist/cli.js`, exposed as the `mcplint` binary.

During development you can run it without building:

```bash
pnpm dev --url <url>
```

## Usage

Provide exactly one connection target:

```bash
# Streamable HTTP MCP server
mcplint --url https://example.com/mcp

# Local stdio MCP server
mcplint --stdio "node server.js"
```

### Options

| Option              | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `--url <url>`       | Connect to a Streamable HTTP MCP server.                           |
| `--stdio <command>` | Spawn a stdio MCP server, e.g. `"node server.js"`.                 |
| `--header <header>` | Extra HTTP header for `--url`, e.g. `"X-Api-Key: abc"`. Repeatable.|
| `--bearer <token>`  | Shorthand for an `Authorization: Bearer <token>` header (`--url`). |
| `--verbose`         | Show the full per-tool findings breakdown (default is compact).    |
| `--debug`           | Pass through the stdio server's own stderr output (`--stdio`).     |
| `--json`            | Output the report as JSON instead of the console view.             |
| `--version`         | Print the version.                                                 |
| `--help`            | Print usage.                                                       |

### Authentication

For servers that require authentication, pass credentials with `--bearer` or
`--header` (HTTP connections only):

```bash
mcplint --url https://example.com/mcp --bearer <token>
mcplint --url https://example.com/mcp --header "X-Api-Key: <key>"
```

If the server rejects the connection due to missing or invalid credentials, the
tool prints an actionable message instead of the raw transport error.

## What it checks

Each tool reported by the server is validated against these rules:

| Rule ID                     | Severity | Description                                  |
| --------------------------- | -------- | -------------------------------------------- |
| `tool-name-empty`           | error    | Tool name is empty.                          |
| `tool-description-missing`  | error    | Tool is missing a description.               |
| `param-description-missing` | error    | An input parameter is missing a description. |
| `tool-name-too-long`        | warning  | Tool name exceeds the recommended length (64).|
| `tool-title-missing`        | warning  | Tool is missing a title annotation.          |
| `hint-readonly-missing`     | warning  | Tool is missing the `readOnlyHint`.          |
| `hint-destructive-missing`  | warning  | Tool is missing the `destructiveHint`.       |
| `hint-idempotent-missing`   | warning  | Tool is missing the `idempotentHint`.        |
| `hint-openworld-missing`    | warning  | Tool is missing the `openWorldHint`.         |
| `output-schema-missing`     | warning  | Tool is missing an `outputSchema`.           |
| `input-schema-missing`      | error    | Tool is missing an `inputSchema`.            |
| `input-schema-invalid`      | error    | `inputSchema` is not a valid JSON Schema.    |
| `input-schema-not-object`   | warning  | `inputSchema` is not of type `object`.       |
| `output-schema-invalid`     | error    | `outputSchema` is not a valid JSON Schema.   |

## Output

The console report lists every tool with a status symbol (`✓` clean, `!`
warnings only, `✗` errors). By default each tool is shown on a single line with
its severity counts, followed by an **Issues by rule** block that aggregates
findings by rule so systemic problems read as one pattern rather than dozens of
identical lines. A final summary shows totals and how many tools are clean.

Pass `--verbose` to expand every tool into its individual findings. When using
`--stdio`, the spawned server's own stderr (npm notices, missing-key hints,
schema warnings) is hidden by default; pass `--debug` to see it.

Use `--json` for a stable, machine-readable report suited to CI:

```json
{
  "server": { "name": "example", "version": "0.0.1" },
  "toolCount": 3,
  "summary": { "errors": 0, "warnings": 6 },
  "findings": [ ... ]
}
```

## Exit codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| `0`  | No errors (warnings may be present).          |
| `1`  | One or more errors were found.                |
| `2`  | Connection, configuration, or analysis error.|

## Development

```bash
pnpm dev --url <url>   # run from source via tsx
pnpm build             # compile to dist/
pnpm typecheck         # type-check without emitting
pnpm test              # run the vitest suite
```

## Requirements

- Node.js >= 18

## License

[MIT](./LICENSE)
