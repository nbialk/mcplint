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
  ],
};
