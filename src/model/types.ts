export type Severity = "error" | "warning";

export type RuleCategory = "structure" | "metadata";

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
  | "output-schema-missing";

export interface Rule {
  id: RuleId;
  category: RuleCategory;
  severity: Severity;
  title: string;
}

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  toolName: string;
  paramName?: string;
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
  [key: string]: unknown;
}

export interface ServerInfo {
  name?: string;
  version?: string;
}

/** Pure data snapshot of the server, decoupled from any live connection. */
export interface McpSnapshot {
  server: ServerInfo;
  tools: ToolInfo[];
}
