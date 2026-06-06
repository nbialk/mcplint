import type { Finding, McpSnapshot } from "../model/types.js";
import { checkTool } from "./deterministic.js";

/** Runs the v1 deterministic linter over a snapshot. */
export function runLinter(snapshot: McpSnapshot): Finding[] {
  const findings: Finding[] = [];
  for (const tool of snapshot.tools) {
    findings.push(...checkTool(tool));
  }
  return findings;
}
