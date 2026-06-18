import type { Finding, RuleId, Severity } from "../model/types.js";
import { RULES } from "../rules.js";

/**
 * Resolves a rule's effective severity, applying the directory-mode promotion:
 * rules flagged with `directoryError` become "error" under --directory.
 */
export function severityFor(ruleId: RuleId, directory: boolean): Severity {
  const rule = RULES[ruleId];
  if (directory && rule.directoryError) return "error";
  return rule.severity;
}

/**
 * Curried Finding factory bound to the active directory mode, so call sites
 * only supply rule-specific data and severity stays consistent.
 */
export function makeFinding(directory: boolean) {
  return function finding(
    ruleId: RuleId,
    toolName: string,
    message: string,
    extra?: { paramName?: string; resourceUri?: string },
  ): Finding {
    return {
      ruleId,
      severity: severityFor(ruleId, directory),
      toolName,
      paramName: extra?.paramName,
      resourceUri: extra?.resourceUri,
      message,
    };
  };
}
