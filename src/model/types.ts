export type Severity = "error" | "warning" | "info";

export type RuleCategory = "structure" | "metadata" | "heuristic";

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
  | "tool-likely-mutating-unannotated";

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
