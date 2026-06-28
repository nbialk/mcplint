export type Severity = "error" | "warning" | "info";

export type RuleCategory = "structure" | "metadata" | "heuristic" | "apps";

export type RuleId =
  | "tool-description-missing"
  | "param-description-missing"
  | "tool-name-empty"
  | "tool-name-too-long"
  | "tool-title-missing"
  | "hint-readonly-missing"
  | "hint-destructive-missing"
  | "hint-idempotent-missing"
  | "hint-openworld-missing"
  | "output-schema-missing"
  | "input-schema-missing"
  | "input-schema-invalid"
  | "input-schema-not-object"
  | "output-schema-invalid"
  | "tool-likely-readonly-unannotated"
  | "tool-likely-mutating-unannotated"
  | "csp-missing"
  | "csp-domains-empty"
  | "csp-frame-domains-declared";

export interface Rule {
  id: RuleId;
  category: RuleCategory;
  severity: Severity;
  title: string;
  /**
   * When true, this rule is promoted to "error" severity in directory mode
   * (--directory), where annotation completeness gates submission.
   */
  directoryError?: boolean;
}

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  /**
   * The subject of the finding. For tool rules this is the tool name; for
   * resource (apps) rules it is the resource name or URI so the existing
   * grouped reporters can render it without changes.
   */
  toolName: string;
  paramName?: string;
  /** Set for resource-scoped (apps) findings; the offending resource URI. */
  resourceUri?: string;
  message: string;
}

/** Minimal shape of a tool we care about, normalized from tools/list. */
export interface ToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchemaObject;
  outputSchema?: JsonSchemaObject;
  annotations?: ToolAnnotations;
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  [key: string]: unknown;
}

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty | JsonSchemaProperty[];
  [key: string]: unknown;
}

export interface ServerInfo {
  name?: string;
  version?: string;
}

/**
 * Content-Security-Policy declared on an MCP Apps UI resource, normalized from
 * either `_meta.ui.csp` (camelCase) or the `openai/widgetCSP` alias
 * (snake_case). Domain lists map to the widget sandbox's connect-src/img-src/
 * frame-src.
 */
export interface ResourceCsp {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
}

/** Minimal shape of a resource we care about, normalized from resources/list. */
export interface ResourceInfo {
  uri: string;
  name?: string;
  mimeType?: string;
  /** Normalized CSP, present only when a CSP object was declared. */
  csp?: ResourceCsp;
  /** Whether any CSP object (either variant) was declared on the resource. */
  cspDeclared: boolean;
  /** True for MCP Apps UI resources (ui:// scheme or the mcp-app MIME type). */
  isUi: boolean;
}

/** Pure data snapshot of the server, decoupled from any live connection. */
export interface McpSnapshot {
  server: ServerInfo;
  tools: ToolInfo[];
  resources: ResourceInfo[];
}
