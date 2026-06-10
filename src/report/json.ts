import type { Finding, McpSnapshot } from "../model/types.js";
import { annotationRollup, summarize } from "./console.js";

/** Stable machine-readable report shape for CI consumption. */
export function renderJson(snapshot: McpSnapshot, findings: Finding[]): string {
  const { errors, warnings, info } = summarize(findings);
  const annotated = annotationRollup(snapshot.tools);
  return JSON.stringify(
    {
      server: snapshot.server,
      toolCount: snapshot.tools.length,
      summary: { errors, warnings, info, annotated },
      findings,
    },
    null,
    2,
  );
}
