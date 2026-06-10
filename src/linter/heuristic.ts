import type { Finding, ToolInfo } from "../model/types.js";
import { RULES } from "../rules.js";

/**
 * Layer-2 heuristic checks. Unlike the deterministic linter, these infer
 * intent from naming conventions rather than declared metadata, so they are
 * opt-in (--experimental) and emit "info" severity only. They never affect
 * exit codes. Findings are explicitly framed as inferred, not authoritative.
 */

const READONLY_NAME = /(^|_)(list|get|search|find|read|fetch|query|show)($|_)/i;
const MUTATING_NAME =
  /(^|_)(create|update|delete|remove|set|add|write|edit|patch|put|post|insert|send|cancel|archive)($|_)/i;

function hasAnyAnnotation(tool: ToolInfo): boolean {
  const ann = tool.annotations;
  if (!ann) return false;
  return (
    typeof ann.readOnlyHint === "boolean" ||
    typeof ann.destructiveHint === "boolean" ||
    typeof ann.idempotentHint === "boolean" ||
    typeof ann.openWorldHint === "boolean"
  );
}

/** Infers read/write intent from a tool's name when annotations are absent. */
export function checkToolHeuristic(tool: ToolInfo): Finding[] {
  const findings: Finding[] = [];
  const name = tool.name || "<unnamed>";

  // Only speak up when there is no declared signal to rely on.
  if (typeof tool.annotations?.readOnlyHint === "boolean") return findings;
  if (!tool.name) return findings;

  if (READONLY_NAME.test(tool.name)) {
    findings.push({
      ruleId: "tool-likely-readonly-unannotated",
      severity: RULES["tool-likely-readonly-unannotated"].severity,
      toolName: name,
      message: `Name suggests a read-only operation; consider readOnlyHint: true (inferred from name).`,
    });
  } else if (MUTATING_NAME.test(tool.name) && !hasAnyAnnotation(tool)) {
    findings.push({
      ruleId: "tool-likely-mutating-unannotated",
      severity: RULES["tool-likely-mutating-unannotated"].severity,
      toolName: name,
      message: `Name suggests a state-changing operation; consider readOnlyHint: false plus destructiveHint/idempotentHint (inferred from name).`,
    });
  }

  return findings;
}
