#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { connect, parseStdioCommand } from "./client/connect.js";
import { fetchSnapshot } from "./client/fetch.js";
import { runLinter } from "./linter/index.js";
import { renderConsole, summarize } from "./report/console.js";
import { renderJson } from "./report/json.js";

interface CliOptions {
  url?: string;
  stdio?: string;
  json?: boolean;
  header?: string[];
  bearer?: string;
}

const program = new Command();

program
  .name("mcp-check")
  .description("Lint the tool definitions of an MCP server")
  .version("1.0.0")
  .option("--url <url>", "connect to a Streamable HTTP MCP server")
  .option("--stdio <command>", "spawn a stdio MCP server, e.g. \"node server.js\"")
  .option(
    "--header <header>",
    "extra HTTP header for --url, e.g. \"X-Api-Key: abc\" (repeatable)",
    collectHeader,
    [],
  )
  .option("--bearer <token>", "shorthand for an Authorization: Bearer header (--url only)")
  .option("--json", "output the report as JSON")
  .action(async (opts: CliOptions) => {
    await run(opts);
  });

function collectHeader(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** Parses "Name: value" header strings into a header map. */
function parseHeaders(raw: string[] | undefined, bearer?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const entry of raw ?? []) {
    const idx = entry.indexOf(":");
    if (idx === -1) {
      fail(`Invalid --header "${entry}". Expected format "Name: value".`);
    }
    const name = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (!name) fail(`Invalid --header "${entry}". Header name is empty.`);
    headers[name] = value;
  }
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  return headers;
}

async function run(opts: CliOptions): Promise<void> {
  if ((opts.url && opts.stdio) || (!opts.url && !opts.stdio)) {
    fail("Provide exactly one of --url or --stdio.");
  }

  const hasAuthFlags = (opts.header && opts.header.length > 0) || !!opts.bearer;
  if (hasAuthFlags && !opts.url) {
    fail("--header and --bearer only apply to --url connections.");
  }

  let client;
  try {
    if (opts.url) {
      const headers = parseHeaders(opts.header, opts.bearer);
      client = await connect({
        kind: "http",
        url: opts.url,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
    } else {
      client = await connect({ kind: "stdio", ...parseStdioCommand(opts.stdio!) });
    }
  } catch (err) {
    failConnect(err, opts);
    return;
  }

  try {
    const snapshot = await fetchSnapshot(client);
    const findings = runLinter(snapshot);

    if (opts.json) {
      console.log(renderJson(snapshot, findings));
    } else {
      renderConsole(snapshot, findings);
    }

    const { errors } = summarize(findings);
    process.exitCode = errors > 0 ? 1 : 0;
  } catch (err) {
    fail(`Failed during analysis: ${errorMessage(err)}`);
  } finally {
    await client.close().catch(() => {});
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Detects auth failures and prints an actionable message instead of raw SDK noise. */
function failConnect(err: unknown, opts: CliOptions): never {
  const raw = errorMessage(err);
  const alreadyAuthed = (opts.header && opts.header.length > 0) || !!opts.bearer;

  if (isAuthError(raw)) {
    const lines = [
      pc.red("error: Authentication required by the MCP server."),
    ];
    if (alreadyAuthed) {
      lines.push(
        pc.dim(
          "  The credentials you provided were rejected. Check the token, scheme, or header name.",
        ),
      );
    } else {
      lines.push(
        pc.dim("  Provide credentials and retry, for example:"),
        pc.dim("    mcp-check --url <url> --bearer <token>"),
        pc.dim('    mcp-check --url <url> --header "X-Api-Key: <key>"'),
      );
    }
    console.error(lines.join("\n"));
    process.exit(2);
  }

  fail(`Failed to connect: ${raw}`);
}

/** Heuristic match for 401/invalid_token style failures across transports. */
function isAuthError(message: string): boolean {
  return /\b401\b|unauthor|invalid_token|forbidden|\b403\b|authoriz/i.test(message);
}

function fail(message: string): never {
  console.error(pc.red(`error: ${message}`));
  process.exit(2);
}

program.parseAsync().catch((err) => {
  fail(errorMessage(err));
});
