import { describe, expect, it } from "vitest";
import { runLinter } from "../src/linter/index.js";
import type { Finding, RuleId } from "../src/model/types.js";
import { parseStdioCommand } from "../src/client/connect.js";
import {
  brokenSnapshot,
  cleanSnapshot,
  heuristicSnapshot,
} from "./fixtures.js";

function rulesFor(toolName: string, snapshot = brokenSnapshot): RuleId[] {
  return runLinter(snapshot)
    .filter((f) => f.toolName === (toolName || "<unnamed>"))
    .map((f) => f.ruleId);
}

function findingFor(
  ruleId: RuleId,
  findings: Finding[],
): Finding | undefined {
  return findings.find((f) => f.ruleId === ruleId);
}

describe("deterministic linter", () => {
  it("produces no findings for a clean server", () => {
    expect(runLinter(cleanSnapshot)).toEqual([]);
  });

  it("flags a tool missing description, title, readOnly/openWorld hints, outputSchema and param description", () => {
    const ids = rulesFor("start");
    expect(ids).toContain("tool-description-missing");
    expect(ids).toContain("tool-title-missing");
    expect(ids).toContain("hint-readonly-missing");
    expect(ids).toContain("hint-openworld-missing");
    expect(ids).toContain("output-schema-missing");
    expect(ids).toContain("param-description-missing");
  });

  it("does not nag about destructive/idempotent hints when readOnlyHint is absent", () => {
    // Spec: destructive/idempotent are only meaningful when readOnlyHint is
    // an explicit false. With readOnlyHint missing, only readOnly is flagged.
    const ids = rulesFor("start");
    expect(ids).not.toContain("hint-destructive-missing");
    expect(ids).not.toContain("hint-idempotent-missing");
  });

  it("flags missing destructive/idempotent hints when readOnlyHint is false", () => {
    const ids = rulesFor("mutate_thing");
    expect(ids).toContain("hint-destructive-missing");
    expect(ids).toContain("hint-idempotent-missing");
    expect(ids).not.toContain("hint-readonly-missing");
  });

  it("flags an empty tool name", () => {
    const ids = rulesFor("");
    expect(ids).toContain("tool-name-empty");
  });

  it("flags an over-long tool name as a warning", () => {
    const ids = rulesFor("x".repeat(80));
    expect(ids).toContain("tool-name-too-long");
  });

  it("flags an invalid inputSchema", () => {
    const ids = rulesFor("bad_input_schema");
    expect(ids).toContain("input-schema-invalid");
  });

  it("flags an inputSchema that is not of type object", () => {
    const ids = rulesFor("array_input_schema");
    expect(ids).toContain("input-schema-not-object");
  });

  it("flags an invalid outputSchema", () => {
    const ids = rulesFor("bad_output_schema");
    expect(ids).toContain("output-schema-invalid");
  });

  it("flags a missing inputSchema", () => {
    const ids = rulesFor("");
    expect(ids).toContain("input-schema-missing");
  });

  it("assigns correct severities", () => {
    const findings = runLinter(brokenSnapshot);
    const desc = findingFor("tool-description-missing", findings);
    const hint = findingFor("hint-readonly-missing", findings);
    expect(desc?.severity).toBe("error");
    expect(hint?.severity).toBe("warning");
  });
});

describe("directory mode", () => {
  it("promotes readOnly/destructive hint warnings to errors", () => {
    const findings = runLinter(brokenSnapshot, { directory: true });
    expect(findingFor("hint-readonly-missing", findings)?.severity).toBe(
      "error",
    );
    expect(findingFor("hint-destructive-missing", findings)?.severity).toBe(
      "error",
    );
  });

  it("leaves title/outputSchema warnings as warnings", () => {
    const findings = runLinter(brokenSnapshot, { directory: true });
    expect(findingFor("tool-title-missing", findings)?.severity).toBe(
      "warning",
    );
    expect(findingFor("output-schema-missing", findings)?.severity).toBe(
      "warning",
    );
  });

  it("does not change severities without the flag", () => {
    const findings = runLinter(brokenSnapshot);
    expect(findingFor("hint-readonly-missing", findings)?.severity).toBe(
      "warning",
    );
  });
});

describe("heuristic layer (opt-in)", () => {
  it("emits nothing unless experimental is enabled", () => {
    const ids = runLinter(heuristicSnapshot).map((f) => f.ruleId);
    expect(ids).not.toContain("tool-likely-readonly-unannotated");
    expect(ids).not.toContain("tool-likely-mutating-unannotated");
  });

  it("infers read-only intent from a *_list name", () => {
    const findings = runLinter(heuristicSnapshot, { experimental: true });
    const f = findingFor("tool-likely-readonly-unannotated", findings);
    expect(f?.toolName).toBe("issue_list");
    expect(f?.severity).toBe("info");
  });

  it("infers mutating intent from a *_create name", () => {
    const findings = runLinter(heuristicSnapshot, { experimental: true });
    const f = findingFor("tool-likely-mutating-unannotated", findings);
    expect(f?.toolName).toBe("comment_create");
    expect(f?.severity).toBe("info");
  });

  it("info findings never count as errors", () => {
    const findings = runLinter(heuristicSnapshot, { experimental: true });
    expect(findings.every((f) => f.severity !== "error")).toBe(true);
  });
});

describe("annotation rollup", () => {
  it("counts fully annotated tools", async () => {
    const { annotationRollup } = await import("../src/report/console.js");
    expect(annotationRollup(cleanSnapshot.tools)).toEqual({
      full: 1,
      total: 1,
    });
    // broken snapshot: only fully-annotated tools count toward `full`.
    const broken = annotationRollup(brokenSnapshot.tools);
    expect(broken.total).toBe(brokenSnapshot.tools.length);
    expect(broken.full).toBeLessThan(broken.total);
  });
});

describe("parseStdioCommand", () => {
  it("splits a plain command", () => {
    expect(parseStdioCommand("node server.js --flag")).toEqual({
      command: "node",
      args: ["server.js", "--flag"],
    });
  });

  it("honors quoted arguments", () => {
    expect(parseStdioCommand('node "my server.js" --x')).toEqual({
      command: "node",
      args: ["my server.js", "--x"],
    });
  });
});
