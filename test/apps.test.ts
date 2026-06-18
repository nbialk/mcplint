import { describe, expect, it } from "vitest";
import { runLinter } from "../src/linter/index.js";
import type { Finding, RuleId } from "../src/model/types.js";
import {
  appsAliasSnapshot,
  appsBrokenSnapshot,
  appsCleanSnapshot,
} from "./fixtures.js";

function rulesFor(subject: string, findings: Finding[]): RuleId[] {
  return findings.filter((f) => f.toolName === subject).map((f) => f.ruleId);
}

describe("apps CSP checks", () => {
  it("produces no findings for a UI resource with a valid CSP", () => {
    expect(runLinter(appsCleanSnapshot)).toEqual([]);
  });

  it("flags a UI resource that declares no CSP", () => {
    const ids = rulesFor("no_csp", runLinter(appsBrokenSnapshot));
    expect(ids).toContain("csp-missing");
  });

  it("flags a CSP that allowlists no connect or resource domains", () => {
    const ids = rulesFor("empty_csp", runLinter(appsBrokenSnapshot));
    expect(ids).toContain("csp-domains-empty");
  });

  it("flags a CSP that declares frameDomains", () => {
    const ids = rulesFor("frames", runLinter(appsBrokenSnapshot));
    expect(ids).toContain("csp-frame-domains-declared");
  });

  it("never checks CSP on non-UI resources", () => {
    const ids = rulesFor("data", runLinter(appsBrokenSnapshot));
    expect(ids).toEqual([]);
  });

  it("accepts CSP declared only via the openai/widgetCSP alias", () => {
    expect(runLinter(appsAliasSnapshot)).toEqual([]);
  });

  it("sets resourceUri on resource findings", () => {
    const findings = runLinter(appsBrokenSnapshot);
    const missing = findings.find((f) => f.ruleId === "csp-missing");
    expect(missing?.resourceUri).toBe("ui://views/no-csp.html");
  });

  it("frameDomains finding is info and never an error", () => {
    const findings = runLinter(appsBrokenSnapshot);
    const frame = findings.find(
      (f) => f.ruleId === "csp-frame-domains-declared",
    );
    expect(frame?.severity).toBe("info");
  });
});

describe("apps CSP directory mode", () => {
  it("promotes csp-missing to an error", () => {
    const findings = runLinter(appsBrokenSnapshot, { directory: true });
    const missing = findings.find((f) => f.ruleId === "csp-missing");
    expect(missing?.severity).toBe("error");
  });

  it("leaves csp-missing a warning without the flag", () => {
    const findings = runLinter(appsBrokenSnapshot);
    const missing = findings.find((f) => f.ruleId === "csp-missing");
    expect(missing?.severity).toBe("warning");
  });
});
