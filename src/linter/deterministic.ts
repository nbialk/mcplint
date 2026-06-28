import { Ajv } from "ajv";
import type { Finding, JsonSchemaProperty, ToolInfo } from "../model/types.js";
import { MAX_TOOL_NAME_LENGTH } from "../rules.js";
import { makeFinding } from "./finding.js";

export interface CheckOptions {
  /** Promote directory-gating rules to "error" severity. */
  directory?: boolean;
}

/**
 * Validates JSON Schema documents against the JSON Schema meta-schema.
 * `strict: false` avoids false positives on MCP-specific schema extensions;
 * we rely on compile()/validateSchema to surface genuine meta-schema errors.
 * `logger: false` silences Ajv's informational notes (e.g. `unknown format
 * "uri"`) so they don't leak into the lint report.
 */
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: true,
  logger: false,
});

/** Compiles a schema, returning a readable error message if it is invalid. */
function validateSchema(schema: unknown): string | null {
  try {
    ajv.compile(schema as object);
    return null;
  } catch (err) {
    const first = ajv.errors?.[0];
    if (first) {
      return `${first.instancePath || "schema"} ${first.message ?? "is invalid"}`;
    }
    return err instanceof Error ? err.message : "Schema is not a valid JSON Schema.";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Guards against pathological/recursive schemas while descending. */
const MAX_SCHEMA_DEPTH = 10;

/**
 * Walks a schema's `properties` recursively, descending into nested objects
 * and array items, and reports every property that lacks a description. Paths
 * use dotted notation for nested objects and `[]` for array items (e.g.
 * `filter.range.start`, `dashcards[].card_id`). Composition keywords
 * (oneOf/anyOf/allOf) and $ref are intentionally not traversed.
 */
function collectMissingDescriptions(
  props: Record<string, JsonSchemaProperty>,
  prefix: string,
  depth: number,
  visit: (path: string) => void,
): void {
  if (depth > MAX_SCHEMA_DEPTH) return;
  for (const [key, schema] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!isNonEmptyString(schema?.description)) {
      visit(path);
    }
    if (schema?.properties) {
      collectMissingDescriptions(schema.properties, path, depth + 1, visit);
    }
    const items = schema?.items;
    const itemSchemas = Array.isArray(items) ? items : items ? [items] : [];
    for (const item of itemSchemas) {
      if (item?.properties) {
        collectMissingDescriptions(item.properties, `${path}[]`, depth + 1, visit);
      }
    }
  }
}

/** Runs all deterministic structure/metadata checks for a single tool. */
export function checkTool(tool: ToolInfo, opts: CheckOptions = {}): Finding[] {
  const finding = makeFinding(opts.directory ?? false);
  const findings: Finding[] = [];
  const name = tool.name || "<unnamed>";

  if (!isNonEmptyString(tool.name)) {
    findings.push(finding("tool-name-empty", name, "Tool name is empty or missing."));
  } else if (tool.name.length > MAX_TOOL_NAME_LENGTH) {
    findings.push(
      finding(
        "tool-name-too-long",
        name,
        `Tool name is ${tool.name.length} chars; keep it within ${MAX_TOOL_NAME_LENGTH}.`,
      ),
    );
  }

  if (!isNonEmptyString(tool.description)) {
    findings.push(
      finding(
        "tool-description-missing",
        name,
        "Tool has no description. The calling model relies on this context.",
      ),
    );
  }

  const hasTitle =
    isNonEmptyString(tool.title) || isNonEmptyString(tool.annotations?.title);
  if (!hasTitle) {
    findings.push(
      finding("tool-title-missing", name, "Tool has no title annotation."),
    );
  }

  // Hint checks follow the MCP spec's conditional semantics: destructiveHint
  // and idempotentHint are only meaningful when readOnlyHint === false. We
  // therefore gate them behind an explicit readOnlyHint: false, which also
  // avoids nagging read-only tools about write-only hints (and the
  // accompanying alert fatigue of 4 redundant warnings per bare tool).
  const ann = tool.annotations ?? {};
  if (typeof ann.readOnlyHint !== "boolean") {
    findings.push(finding("hint-readonly-missing", name, "Missing readOnlyHint."));
  } else if (ann.readOnlyHint === false) {
    if (typeof ann.destructiveHint !== "boolean") {
      findings.push(
        finding(
          "hint-destructive-missing",
          name,
          "readOnlyHint is false but destructiveHint is missing; clients need this to gauge risk.",
        ),
      );
    }
    if (typeof ann.idempotentHint !== "boolean") {
      findings.push(
        finding(
          "hint-idempotent-missing",
          name,
          "readOnlyHint is false but idempotentHint is missing.",
        ),
      );
    }
  }
  if (typeof ann.openWorldHint !== "boolean") {
    findings.push(
      finding("hint-openworld-missing", name, "Missing openWorldHint."),
    );
  }

  if (!tool.outputSchema) {
    findings.push(
      finding(
        "output-schema-missing",
        name,
        "Tool has no outputSchema describing its structured response.",
      ),
    );
  } else {
    const outputError = validateSchema(tool.outputSchema);
    if (outputError) {
      findings.push(
        finding("output-schema-invalid", name, `Invalid outputSchema: ${outputError}`),
      );
    }
  }

  if (!tool.inputSchema) {
    findings.push(
      finding(
        "input-schema-missing",
        name,
        "Tool has no inputSchema describing its parameters.",
      ),
    );
  } else {
    const inputError = validateSchema(tool.inputSchema);
    if (inputError) {
      findings.push(
        finding("input-schema-invalid", name, `Invalid inputSchema: ${inputError}`),
      );
    } else if (tool.inputSchema.type !== "object") {
      findings.push(
        finding(
          "input-schema-not-object",
          name,
          `inputSchema type is "${tool.inputSchema.type ?? "undefined"}"; MCP expects "object".`,
        ),
      );
    }
  }

  const props = tool.inputSchema?.properties;
  if (props) {
    collectMissingDescriptions(props, "", 0, (paramName) => {
      findings.push(
        finding(
          "param-description-missing",
          name,
          `Parameter "${paramName}" has no description.`,
          { paramName },
        ),
      );
    });
  }

  return findings;
}
