import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  JsonSchemaObject,
  McpSnapshot,
  ToolAnnotations,
  ToolInfo,
} from "../model/types.js";

/**
 * Collects a pure-data snapshot of the server: server identity plus the
 * normalized tool list. Decoupled from the live connection so that all
 * analysis runs over plain data.
 */
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

function normalizeTool(tool: Record<string, unknown>): ToolInfo {
  return {
    name: typeof tool.name === "string" ? tool.name : "",
    title: typeof tool.title === "string" ? tool.title : undefined,
    description:
      typeof tool.description === "string" ? tool.description : undefined,
    inputSchema: tool.inputSchema as JsonSchemaObject | undefined,
    outputSchema: tool.outputSchema as JsonSchemaObject | undefined,
    annotations: tool.annotations as ToolAnnotations | undefined,
  };
}
