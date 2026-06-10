import type { Rule, RuleId } from "./model/types.js";

/** Central registry: single source of truth for rule severity and titles. */
export const RULES: Record<RuleId, Rule> = {
  "tool-description-missing": {
    id: "tool-description-missing",
    category: "metadata",
    severity: "error",
    title: "Tool is missing a description",
  },
  "param-description-missing": {
    id: "param-description-missing",
    category: "metadata",
    severity: "error",
    title: "Input parameter is missing a description",
  },
  "tool-name-empty": {
    id: "tool-name-empty",
    category: "structure",
    severity: "error",
    title: "Tool name is empty",
  },
  "tool-name-too-long": {
    id: "tool-name-too-long",
    category: "structure",
    severity: "warning",
    title: "Tool name exceeds recommended length",
  },
  "tool-title-missing": {
    id: "tool-title-missing",
    category: "metadata",
    severity: "warning",
    title: "Tool is missing a title annotation",
  },
  "hint-readonly-missing": {
    id: "hint-readonly-missing",
    category: "metadata",
    severity: "warning",
    title: "Tool is missing the readOnlyHint annotation",
    directoryError: true,
  },
  "hint-destructive-missing": {
    id: "hint-destructive-missing",
    category: "metadata",
    severity: "warning",
    title: "Tool is missing the destructiveHint annotation",
    directoryError: true,
  },
  "hint-idempotent-missing": {
    id: "hint-idempotent-missing",
    category: "metadata",
    severity: "warning",
    title: "Tool is missing the idempotentHint annotation",
  },
  "hint-openworld-missing": {
    id: "hint-openworld-missing",
    category: "metadata",
    severity: "warning",
    title: "Tool is missing the openWorldHint annotation",
  },
  "output-schema-missing": {
    id: "output-schema-missing",
    category: "structure",
    severity: "warning",
    title: "Tool is missing an outputSchema",
  },
  "input-schema-missing": {
    id: "input-schema-missing",
    category: "structure",
    severity: "error",
    title: "Tool is missing an inputSchema",
  },
  "input-schema-invalid": {
    id: "input-schema-invalid",
    category: "structure",
    severity: "error",
    title: "Tool inputSchema is not a valid JSON Schema",
  },
  "input-schema-not-object": {
    id: "input-schema-not-object",
    category: "structure",
    severity: "warning",
    title: "Tool inputSchema is not of type object",
  },
  "output-schema-invalid": {
    id: "output-schema-invalid",
    category: "structure",
    severity: "error",
    title: "Tool outputSchema is not a valid JSON Schema",
  },
  "tool-likely-readonly-unannotated": {
    id: "tool-likely-readonly-unannotated",
    category: "heuristic",
    severity: "info",
    title: "Tool name suggests it is read-only but has no readOnlyHint",
  },
  "tool-likely-mutating-unannotated": {
    id: "tool-likely-mutating-unannotated",
    category: "heuristic",
    severity: "info",
    title: "Tool name suggests it mutates state but has no annotations",
  },
};

/** MCP convention: tool names should stay within this length. */
export const MAX_TOOL_NAME_LENGTH = 64;
