import type { Finding, McpSnapshot } from "../model/types.js";
import { checkResourceCsp } from "./apps.js";
import { checkTool } from "./deterministic.js";
import { checkToolHeuristic } from "./heuristic.js";

export interface LinterOptions {
  /** Promote directory-gating rules to "error" severity. */
  directory?: boolean;
  /** Enable opt-in Layer-2 heuristic (name-based) checks. */
  experimental?: boolean;
}

/** Runs the v1 deterministic linter over a snapshot. */
export function runLinter(
  snapshot: McpSnapshot,
  opts: LinterOptions = {},
): Finding[] {
  const findings: Finding[] = [];
  for (const tool of snapshot.tools) {
    findings.push(...checkTool(tool, { directory: opts.directory }));
    if (opts.experimental) {
      findings.push(...checkToolHeuristic(tool));
    }
  }
  for (const resource of snapshot.resources ?? []) {
    findings.push(...checkResourceCsp(resource, { directory: opts.directory }));
  }
  return findings;
}
