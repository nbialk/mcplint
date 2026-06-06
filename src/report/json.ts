import type { Finding, McpSnapshot } from "../model/types.js";
import { summarize } from "./console.js";

/** Stable machine-readable report shape for CI consumption. */
export function renderJson(snapshot: McpSnapshot, findings: Finding[]): string {
  const { errors, warnings } = summarize(findings);
  return JSON.stringify(
    {
      server: snapshot.server,
      toolCount: snapshot.tools.length,
      summary: { errors, warnings },
      findings,
    },
    null,
    2,
  );
}
