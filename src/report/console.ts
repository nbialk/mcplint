import pc from "picocolors";
import type { Finding, McpSnapshot, RuleId, ToolInfo } from "../model/types.js";
import { RULES } from "../rules.js";

export interface ReportSummary {
  errors: number;
  warnings: number;
}

/** Tool-level rules in registry order; param rules are handled per parameter. */
const TOOL_RULE_IDS = (Object.keys(RULES) as RuleId[]).filter(
  (id) => id !== "param-description-missing",
);

/** Positive wording shown for a passed check (rule titles describe failures). */
const PASS_LABELS: Record<RuleId, string> = {
  "tool-description-missing": "Has a description",
  "param-description-missing": "All parameters documented",
  "tool-name-empty": "Has a name",
  "tool-name-too-long": "Name length within limit",
  "tool-title-missing": "Has a title annotation",
  "hint-readonly-missing": "Declares readOnlyHint",
  "hint-destructive-missing": "Declares destructiveHint",
  "hint-idempotent-missing": "Declares idempotentHint",
  "hint-openworld-missing": "Declares openWorldHint",
  "output-schema-missing": "Has an outputSchema",
};

export function summarize(findings: Finding[]): ReportSummary {
  let errors = 0;
  let warnings = 0;
  for (const f of findings) {
    if (f.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings };
}

/** Renders a grouped, colorized report to stdout. */
export function renderConsole(
  snapshot: McpSnapshot,
  findings: Finding[],
): void {
  const serverLabel = snapshot.server.name
    ? `${snapshot.server.name}${
        snapshot.server.version ? ` v${snapshot.server.version}` : ""
      }`
    : "(unknown server)";

  console.log(pc.bold(`\nMCP linter — ${serverLabel}`));
  console.log(pc.dim(`${snapshot.tools.length} tool(s) checked\n`));

  const byTool = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = f.toolName;
    const list = byTool.get(key) ?? [];
    list.push(f);
    byTool.set(key, list);
  }

  let cleanTools = 0;
  for (const tool of snapshot.tools) {
    const key = tool.name || "<unnamed>";
    const group = byTool.get(key) ?? [];
    if (group.length === 0) cleanTools++;
    renderTool(tool, key, group);
  }

  const { errors, warnings } = summarize(findings);
  const parts: string[] = [];
  if (errors) parts.push(pc.red(`${errors} error${errors === 1 ? "" : "s"}`));
  if (warnings)
    parts.push(pc.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`));
  if (parts.length === 0) parts.push(pc.green("no issues"));

  const toolCount = snapshot.tools.length;
  console.log(
    pc.bold(
      `${parts.join(", ")}  ${pc.dim(
        `(${cleanTools}/${toolCount} tool${toolCount === 1 ? "" : "s"} clean)`,
      )}\n`,
    ),
  );
}

/** Renders one tool: a status header, its findings, then passed checks. */
function renderTool(tool: ToolInfo, key: string, group: Finding[]): void {
  const hasError = group.some((f) => f.severity === "error");
  const symbol = hasError
    ? pc.red("✗")
    : group.length > 0
      ? pc.yellow("!")
      : pc.green("✓");
  console.log(`${symbol} ${pc.underline(key)}`);

  for (const f of group) {
    const tag =
      f.severity === "error" ? pc.red("error  ") : pc.yellow("warning");
    console.log(`  ${tag}  ${f.message}  ${pc.dim(f.ruleId)}`);
  }

  for (const ruleId of passedRules(tool, group)) {
    console.log(`  ${pc.green("✓")}  ${PASS_LABELS[ruleId]}  ${pc.dim(ruleId)}`);
  }

  console.log("");
}

/** Tool-level rules that produced no finding for this tool. */
function passedRules(tool: ToolInfo, group: Finding[]): RuleId[] {
  const failed = new Set(group.map((f) => f.ruleId));
  return TOOL_RULE_IDS.filter((id) => !failed.has(id) && appliesToTool(id, tool));
}

/** Skip name-length as "passed" when the name is empty (name-empty applies instead). */
function appliesToTool(ruleId: RuleId, tool: ToolInfo): boolean {
  if (ruleId === "tool-name-too-long") return tool.name.trim().length > 0;
  if (ruleId === "tool-name-empty") return tool.name.trim().length > 0;
  return true;
}
