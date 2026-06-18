import pc from "picocolors";
import type {
  Finding,
  McpSnapshot,
  ResourceInfo,
  ToolInfo,
} from "../model/types.js";

export interface ReportSummary {
  errors: number;
  warnings: number;
  info: number;
}

export function summarize(findings: Finding[]): ReportSummary {
  let errors = 0;
  let warnings = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === "error") errors++;
    else if (f.severity === "info") info++;
    else warnings++;
  }
  return { errors, warnings, info };
}

export interface AnnotationRollup {
  full: number;
  total: number;
}

/** A tool is "fully annotated" when all four MCP hints are declared booleans. */
function isFullyAnnotated(tool: ToolInfo): boolean {
  const ann = tool.annotations;
  if (!ann) return false;
  return (
    typeof ann.readOnlyHint === "boolean" &&
    typeof ann.destructiveHint === "boolean" &&
    typeof ann.idempotentHint === "boolean" &&
    typeof ann.openWorldHint === "boolean"
  );
}

export function annotationRollup(tools: ToolInfo[]): AnnotationRollup {
  let full = 0;
  for (const tool of tools) {
    if (isFullyAnnotated(tool)) full++;
  }
  return { full, total: tools.length };
}

export interface RenderOptions {
  /** Show the full per-tool findings breakdown instead of the compact view. */
  verbose?: boolean;
}

/** Renders a grouped, colorized report to stdout. */
export function renderConsole(
  snapshot: McpSnapshot,
  findings: Finding[],
  options: RenderOptions = {},
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
    renderTool(key, group, options.verbose ?? false);
  }

  renderResources(snapshot, byTool, options.verbose ?? false);

  renderRuleSummary(findings);

  const { errors, warnings, info } = summarize(findings);
  const parts: string[] = [];
  if (errors) parts.push(pc.red(`${errors} error${errors === 1 ? "" : "s"}`));
  if (warnings)
    parts.push(pc.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`));
  if (info) parts.push(pc.blue(`${info} info`));
  if (parts.length === 0) parts.push(pc.green("no issues"));

  const toolCount = snapshot.tools.length;
  console.log(
    pc.bold(
      `${parts.join(", ")}  ${pc.dim(
        `(${cleanTools}/${toolCount} tool${toolCount === 1 ? "" : "s"} clean)`,
      )}`,
    ),
  );

  const rollup = annotationRollup(snapshot.tools);
  console.log(
    pc.dim(
      `${rollup.full}/${rollup.total} tool${
        rollup.total === 1 ? "" : "s"
      } fully annotated\n`,
    ),
  );
}

/**
 * Renders the MCP Apps UI resources (those carrying CSP findings) under their
 * own heading, so resource-scoped findings are visible in compact mode rather
 * than only surfacing in the rule rollup.
 */
function renderResources(
  snapshot: McpSnapshot,
  byTool: Map<string, Finding[]>,
  verbose: boolean,
): void {
  const uiResources = snapshot.resources.filter((r) => r.isUi);
  if (uiResources.length === 0) return;

  console.log(pc.bold(`\nUI resources (${uiResources.length})`));
  for (const resource of uiResources) {
    const key = resourceKey(resource);
    const group = byTool.get(key) ?? [];
    renderTool(key, group, verbose);
  }
}

function resourceKey(resource: ResourceInfo): string {
  return resource.name || resource.uri;
}

/**
 * Renders one tool. In verbose mode this is a status header followed by every
 * finding; in compact mode (default) it is a single line with severity counts,
 * so a large server with repetitive findings stays scannable.
 */
function renderTool(key: string, group: Finding[], verbose: boolean): void {
  const symbol = statusSymbol(group);

  if (!verbose) {
    const counts = summarize(group);
    const tally: string[] = [];
    if (counts.errors) tally.push(pc.red(`${counts.errors} error${plural(counts.errors)}`));
    if (counts.warnings)
      tally.push(pc.yellow(`${counts.warnings} warning${plural(counts.warnings)}`));
    if (counts.info) tally.push(pc.blue(`${counts.info} info`));
    const suffix = tally.length > 0 ? `  ${pc.dim(tally.join(", "))}` : "";
    console.log(`${symbol} ${key}${suffix}`);
    return;
  }

  console.log(`${symbol} ${pc.underline(key)}`);
  for (const f of group) {
    console.log(`  ${severityTag(f.severity)}  ${f.message}  ${pc.dim(f.ruleId)}`);
  }
  if (group.length > 0) console.log("");
}

/**
 * Aggregates findings by ruleId so systemic problems read as one pattern (e.g.
 * "tool-title-missing — 22 tools") rather than dozens of identical lines.
 */
function renderRuleSummary(findings: Finding[]): void {
  if (findings.length === 0) return;

  const byRule = new Map<
    string,
    { severity: Finding["severity"]; message: string; tools: Set<string> }
  >();
  for (const f of findings) {
    const entry = byRule.get(f.ruleId);
    if (entry) {
      entry.tools.add(f.toolName);
    } else {
      byRule.set(f.ruleId, {
        severity: f.severity,
        message: f.message,
        tools: new Set([f.toolName]),
      });
    }
  }

  const order = { error: 0, warning: 1, info: 2 } as const;
  const rows = [...byRule.entries()].sort(
    (a, b) =>
      order[a[1].severity] - order[b[1].severity] ||
      b[1].tools.size - a[1].tools.size,
  );

  const ruleWidth = Math.max(...rows.map(([ruleId]) => ruleId.length));

  console.log(pc.bold("\nIssues by rule"));
  for (const [ruleId, info] of rows) {
    const count = info.tools.size;
    const where = `${count} tool${plural(count)}`;
    console.log(
      `  ${severityTag(info.severity)}  ${ruleId.padEnd(ruleWidth)}  ${pc.dim(where)}`,
    );
  }
  console.log("");
}

function statusSymbol(group: Finding[]): string {
  const hasError = group.some((f) => f.severity === "error");
  const hasWarning = group.some((f) => f.severity === "warning");
  return hasError
    ? pc.red("✗")
    : hasWarning
      ? pc.yellow("!")
      : group.length > 0
        ? pc.blue("i")
        : pc.green("✓");
}

function severityTag(severity: Finding["severity"]): string {
  return severity === "error"
    ? pc.red("error  ")
    : severity === "info"
      ? pc.blue("info   ")
      : pc.yellow("warning");
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}
