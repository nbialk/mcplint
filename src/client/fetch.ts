import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  JsonSchemaObject,
  McpSnapshot,
  ResourceCsp,
  ResourceInfo,
  ToolAnnotations,
  ToolInfo,
} from "../model/types.js";

const UI_MIME_TYPE = "text/html;profile=mcp-app";

/**
 * Collects a pure-data snapshot of the server: server identity, the normalized
 * tool list, and the normalized resource list. Decoupled from the live
 * connection so that all analysis runs over plain data.
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
    resources: await fetchResources(client),
  };
}

/**
 * Lists resources when the server advertises the capability. Returns [] for
 * servers without resources rather than treating it as an error, since most
 * tool-only servers (and CSP checks) simply have nothing to inspect here.
 */
async function fetchResources(client: Client): Promise<ResourceInfo[]> {
  if (!client.getServerCapabilities()?.resources) return [];
  try {
    const { resources } = await client.listResources();
    return resources.map(normalizeResource);
  } catch {
    return [];
  }
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

function normalizeResource(resource: Record<string, unknown>): ResourceInfo {
  const uri = typeof resource.uri === "string" ? resource.uri : "";
  const mimeType =
    typeof resource.mimeType === "string" ? resource.mimeType : undefined;
  const meta = resource._meta as Record<string, unknown> | undefined;
  const csp = extractCsp(meta);

  return {
    uri,
    name: typeof resource.name === "string" ? resource.name : undefined,
    mimeType,
    csp,
    cspDeclared: csp !== undefined,
    isUi: uri.startsWith("ui://") || mimeType === UI_MIME_TYPE,
  };
}

/**
 * Normalizes the CSP declaration from either `_meta.ui.csp` (camelCase, the MCP
 * Apps standard) or the `openai/widgetCSP` alias (snake_case). Returns
 * undefined when neither is present, signalling that no CSP was declared.
 */
function extractCsp(meta: Record<string, unknown> | undefined): ResourceCsp | undefined {
  if (!meta) return undefined;

  const ui = meta.ui as Record<string, unknown> | undefined;
  const standard = ui?.csp as Record<string, unknown> | undefined;
  if (standard) {
    return {
      connectDomains: stringArray(standard.connectDomains),
      resourceDomains: stringArray(standard.resourceDomains),
      frameDomains: stringArray(standard.frameDomains),
    };
  }

  const alias = meta["openai/widgetCSP"] as Record<string, unknown> | undefined;
  if (alias) {
    return {
      connectDomains: stringArray(alias.connect_domains),
      resourceDomains: stringArray(alias.resource_domains),
      // The alias has no frame-domain concept; leave frameDomains undefined.
    };
  }

  return undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((v): v is string => typeof v === "string");
  return items.length > 0 ? items : undefined;
}
