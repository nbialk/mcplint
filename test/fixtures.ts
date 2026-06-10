import type { McpSnapshot } from "../src/model/types.js";

/** A fully compliant server: no findings expected. */
export const cleanSnapshot: McpSnapshot = {
  server: { name: "clean-server", version: "1.0.0" },
  tools: [
    {
      name: "search_docs",
      title: "Search Docs",
      description: "Search the documentation for a query.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
        },
        required: ["query"],
      },
      outputSchema: { type: "object" },
      annotations: {
        title: "Search Docs",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  ],
};

/** A broken server exercising every rule. */
export const brokenSnapshot: McpSnapshot = {
  server: { name: "broken-server", version: "0.0.1" },
  tools: [
    {
      // missing description, title, all hints, outputSchema; param has no description
      name: "start",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string" },
        },
      },
    },
    {
      name: "",
      description: "Has empty name.",
      annotations: {
        title: "Empty Name",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      outputSchema: { type: "object" },
    },
    {
      name: "x".repeat(80),
      title: "Too Long",
      description: "Name exceeds the length limit.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      outputSchema: { type: "object" },
    },
    {
      // inputSchema is a malformed JSON Schema (required must be an array)
      name: "bad_input_schema",
      title: "Bad Input Schema",
      description: "Has an invalid inputSchema.",
      inputSchema: {
        type: "object",
        required: "not-an-array" as unknown as string[],
      },
      outputSchema: { type: "object" },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    {
      // inputSchema is valid JSON Schema but not of type object
      name: "array_input_schema",
      title: "Array Input Schema",
      description: "inputSchema is an array, not an object.",
      inputSchema: { type: "array" },
      outputSchema: { type: "object" },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    {
      // outputSchema is a malformed JSON Schema (type must be a known type)
      name: "bad_output_schema",
      title: "Bad Output Schema",
      description: "Has an invalid outputSchema.",
      inputSchema: { type: "object" },
      outputSchema: { type: "not-a-real-type" },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    {
      // readOnlyHint: false, so destructive/idempotent hints become meaningful
      // and their absence must be flagged (the gated branch).
      name: "mutate_thing",
      title: "Mutate Thing",
      description: "A write tool that omits destructive/idempotent hints.",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
  ],
};

/**
 * Tools whose names imply read/write intent but carry no annotations.
 * Exercises the opt-in heuristic layer.
 */
export const heuristicSnapshot: McpSnapshot = {
  server: { name: "heuristic-server", version: "1.0.0" },
  tools: [
    {
      name: "issue_list",
      title: "List Issues",
      description: "Lists issues.",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
    {
      name: "comment_create",
      title: "Create Comment",
      description: "Creates a comment.",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
  ],
};
