import type { Finding, RuleId, ToolInfo } from "../model/types.js";
import { MAX_TOOL_NAME_LENGTH, RULES } from "../rules.js";

function finding(
  ruleId: RuleId,
  toolName: string,
  message: string,
  paramName?: string,
): Finding {
  return {
    ruleId,
    severity: RULES[ruleId].severity,
    toolName,
    paramName,
    message,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Runs all deterministic structure/metadata checks for a single tool. */
export function checkTool(tool: ToolInfo): Finding[] {
  const findings: Finding[] = [];
  const name = tool.name || "<unnamed>";

  if (!isNonEmptyString(tool.name)) {
    findings.push(finding("tool-name-empty", name, "Tool name is empty or missing."));
  } else if (tool.name.length > MAX_TOOL_NAME_LENGTH) {
    findings.push(
      finding(
        "tool-name-too-long",
        name,
        `Tool name is ${tool.name.length} chars; keep it within ${MAX_TOOL_NAME_LENGTH}.`,
      ),
    );
  }

  if (!isNonEmptyString(tool.description)) {
    findings.push(
      finding(
        "tool-description-missing",
        name,
        "Tool has no description. The calling model relies on this context.",
      ),
    );
  }

  const hasTitle =
    isNonEmptyString(tool.title) || isNonEmptyString(tool.annotations?.title);
  if (!hasTitle) {
    findings.push(
      finding("tool-title-missing", name, "Tool has no title annotation."),
    );
  }

  const ann = tool.annotations ?? {};
  if (typeof ann.readOnlyHint !== "boolean") {
    findings.push(finding("hint-readonly-missing", name, "Missing readOnlyHint."));
  }
  if (typeof ann.destructiveHint !== "boolean") {
    findings.push(
      finding("hint-destructive-missing", name, "Missing destructiveHint."),
    );
  }
  if (typeof ann.idempotentHint !== "boolean") {
    findings.push(
      finding("hint-idempotent-missing", name, "Missing idempotentHint."),
    );
  }
  if (typeof ann.openWorldHint !== "boolean") {
    findings.push(
      finding("hint-openworld-missing", name, "Missing openWorldHint."),
    );
  }

  if (!tool.outputSchema) {
    findings.push(
      finding(
        "output-schema-missing",
        name,
        "Tool has no outputSchema describing its structured response.",
      ),
    );
  }

  const props = tool.inputSchema?.properties;
  if (props) {
    for (const [paramName, schema] of Object.entries(props)) {
      if (!isNonEmptyString(schema?.description)) {
        findings.push(
          finding(
            "param-description-missing",
            name,
            `Parameter "${paramName}" has no description.`,
            paramName,
          ),
        );
      }
    }
  }

  return findings;
}
