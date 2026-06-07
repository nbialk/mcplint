import { describe, expect, it } from "vitest";
import { runLinter } from "../src/linter/index.js";
import type { RuleId } from "../src/model/types.js";
import { parseStdioCommand } from "../src/client/connect.js";
import { brokenSnapshot, cleanSnapshot } from "./fixtures.js";

function rulesFor(toolName: string, snapshot = brokenSnapshot): RuleId[] {
  return runLinter(snapshot)
    .filter((f) => f.toolName === (toolName || "<unnamed>"))
    .map((f) => f.ruleId);
}

describe("deterministic linter", () => {
  it("produces no findings for a clean server", () => {
    expect(runLinter(cleanSnapshot)).toEqual([]);
  });

  it("flags a tool missing description, title, hints, outputSchema and param description", () => {
    const ids = rulesFor("start");
    expect(ids).toContain("tool-description-missing");
    expect(ids).toContain("tool-title-missing");
    expect(ids).toContain("hint-readonly-missing");
    expect(ids).toContain("hint-destructive-missing");
    expect(ids).toContain("hint-idempotent-missing");
    expect(ids).toContain("hint-openworld-missing");
    expect(ids).toContain("output-schema-missing");
    expect(ids).toContain("param-description-missing");
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
    const desc = findings.find((f) => f.ruleId === "tool-description-missing");
    const hint = findings.find((f) => f.ruleId === "hint-readonly-missing");
    expect(desc?.severity).toBe("error");
    expect(hint?.severity).toBe("warning");
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
