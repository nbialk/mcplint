import pc from "picocolors";
import type { Finding, McpSnapshot } from "../model/types.js";

export interface ReportSummary {
  errors: number;
  warnings: number;
}

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
    renderTool(key, group);
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

/** Renders one tool: a status header followed by its findings (if any). */
function renderTool(key: string, group: Finding[]): void {
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

  if (group.length > 0) console.log("");
}
