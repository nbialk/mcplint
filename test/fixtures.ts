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
          filter: {
            type: "object",
            description: "Optional result filter.",
            properties: {
              limit: { type: "number", description: "Max results to return." },
            },
          },
          tags: {
            type: "array",
            description: "Tag filters to apply.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Tag name." },
              },
            },
          },
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
  resources: [],
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
    {
      // nested object property and array-of-objects whose inner fields lack
      // descriptions: exercises the recursive param-description walk.
      name: "nested_params",
      title: "Nested Params",
      description: "Has undescribed nested object and array-item fields.",
      inputSchema: {
        type: "object",
        properties: {
          filter: {
            type: "object",
            description: "A filter.",
            properties: {
              // missing description -> filter.field
              field: { type: "string" },
            },
          },
          dashcards: {
            type: "array",
            description: "Cards to place.",
            items: {
              type: "object",
              properties: {
                // missing description -> dashcards[].card_id
                card_id: { type: "number" },
              },
            },
          },
        },
      },
      outputSchema: { type: "object" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  ],
  resources: [],
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
  resources: [],
};

/** An MCP Apps server whose single UI resource declares a valid CSP. */
export const appsCleanSnapshot: McpSnapshot = {
  server: { name: "apps-clean", version: "1.0.0" },
  tools: [],
  resources: [
    {
      uri: "ui://views/widget.html",
      name: "widget",
      cspDeclared: true,
      isUi: true,
      csp: {
        connectDomains: ["https://api.example.com"],
        resourceDomains: ["https://cdn.example.com"],
      },
    },
  ],
};

/** An MCP Apps server exercising every CSP rule plus a non-UI resource. */
export const appsBrokenSnapshot: McpSnapshot = {
  server: { name: "apps-broken", version: "0.0.1" },
  tools: [],
  resources: [
    {
      // no CSP declared at all
      uri: "ui://views/no-csp.html",
      name: "no_csp",
      cspDeclared: false,
      isUi: true,
    },
    {
      // CSP object present but allowlists nothing
      uri: "ui://views/empty-csp.html",
      name: "empty_csp",
      cspDeclared: true,
      isUi: true,
      csp: {},
    },
    {
      // declares frameDomains (discouraged)
      uri: "ui://views/frames.html",
      name: "frames",
      cspDeclared: true,
      isUi: true,
      csp: {
        connectDomains: ["https://api.example.com"],
        frameDomains: ["https://embed.example.com"],
      },
    },
    {
      // a normal data resource: must never be CSP-checked
      uri: "file:///data.json",
      name: "data",
      mimeType: "application/json",
      cspDeclared: false,
      isUi: false,
    },
  ],
};

/** A UI resource declaring CSP only via the openai/widgetCSP alias. */
export const appsAliasSnapshot: McpSnapshot = {
  server: { name: "apps-alias", version: "1.0.0" },
  tools: [],
  resources: [
    {
      uri: "ui://views/alias.html",
      name: "alias",
      cspDeclared: true,
      isUi: true,
      csp: {
        connectDomains: ["https://api.example.com"],
        resourceDomains: ["https://cdn.example.com"],
      },
    },
  ],
};
