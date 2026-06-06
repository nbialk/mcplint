import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export type ConnectOptions =
  | { kind: "http"; url: string; headers?: Record<string, string> }
  | { kind: "stdio"; command: string; args: string[] };

const CLIENT_INFO = { name: "mcp-cli-checker", version: "1.0.0" };

/**
 * Builds a transport, connects a client (which performs the initialize
 * handshake), and returns the connected client. Caller is responsible for
 * calling close().
 */
export async function connect(opts: ConnectOptions): Promise<Client> {
  const transport = buildTransport(opts);
  const client = new Client(CLIENT_INFO, { capabilities: {} });
  await client.connect(transport);
  return client;
}

function buildTransport(opts: ConnectOptions): Transport {
  if (opts.kind === "http") {
    return new StreamableHTTPClientTransport(new URL(opts.url), {
      requestInit: opts.headers ? { headers: opts.headers } : undefined,
    });
  }
  return new StdioClientTransport({
    command: opts.command,
    args: opts.args,
  });
}

/**
 * Splits a stdio command string into command + args, honoring simple
 * single/double quotes. v1 keeps this intentionally minimal.
 */
export function parseStdioCommand(input: string): {
  command: string;
  args: string[];
} {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  if (tokens.length === 0) {
    throw new Error("Empty stdio command");
  }
  const [command, ...args] = tokens;
  return { command: command!, args };
}
