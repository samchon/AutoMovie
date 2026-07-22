import { TestValidator } from "@nestia/e2e";

import { openMcpStdio } from "../internal/mcpStdio";

/**
 * Detect a double-encoding artifact: UTF-8 text decoded once through Latin-1
 * and re-encoded. The tell is U+00E2 (the Latin-1 reading of a UTF-8 lead byte)
 * followed by another high byte, or the U+FFFD replacement character a lossy
 * decode leaves behind.
 */
const hasDoubleEncoding = (text: string): boolean => {
  if (text.includes(String.fromCharCode(0xfffd))) return true;
  for (let i = 0; i + 1 < text.length; i++)
    if (
      text.charCodeAt(i) === 0xe2 &&
      text.charCodeAt(i + 1) >= 0x80 &&
      text.charCodeAt(i + 1) <= 0xff
    )
      return true;
  return false;
};

/** JSON size of one schema, the unit every budget below is counted in. */
const schemaChars = (schema: unknown): number =>
  JSON.stringify(schema ?? {}).length;

/**
 * The shape this scenario reads out of an advertised tool schema: the `$defs`
 * map whose entries are the inlined type closure, and nothing else.
 *
 * Declared rather than cast past. A tool's schema arrives as an untyped JSON
 * object, and stating what this scenario expects to find in it is what lets the
 * closure walk below stay typed end to end; reading it as an opaque bag and
 * asserting `number` at the arithmetic would only move the claim to where it
 * cannot be checked.
 */
interface IAdvertisedSchema {
  /** Inlined type definitions, keyed by name. Their contents are not read. */
  $defs?: Record<string, unknown>;
}

/** Total serialized size of every `$defs` entry one schema inlines. */
const closureChars = (schema: unknown): number => {
  const defs = (schema as IAdvertisedSchema | undefined)?.$defs;
  if (defs === undefined) return 0;
  let chars = 0;
  for (const definition of Object.values(defs))
    chars += JSON.stringify(definition).length;
  return chars;
};

/**
 * Total advertised schema payload, in characters.
 *
 * COUNTING RULE, stated so an independent measurement cannot disagree by
 * accident: sum, over every tool in `tools/list`, of
 * `JSON.stringify(tool.inputSchema).length +
 * JSON.stringify(tool.outputSchema).length`, with a missing schema counted as
 * `{}` (2). This excludes the response envelope, the tool names, and the
 * descriptions, which are budgeted separately; the raw JSON-RPC line is a few
 * tens of characters larger.
 *
 * The number is a CEILING, not a target. It leaves measured room for additive
 * fields in the one shared graph, but less headroom than another inlined
 * `$defs` closure, which is the property scenario 5 pins directly.
 */
const SCHEMA_PAYLOAD_BUDGET = 500_000;

/**
 * Per-tool schema ceiling, same counting rule over one tool. `execute` owns the
 * shared graph and is deliberately allowed most, but not all, of the total: a
 * total-only budget could hide an accidental second large entry point.
 */
const PER_TOOL_SCHEMA_BUDGET = 475_000;

/**
 * The MCP surface's HARD budgets, machine-enforced. Tool descriptions and the
 * server instruction ship verbatim to client LLMs (#1129): a description past
 * the 1023-character cap truncates silently, an opening that buries the
 * server's purpose past the ~512-character decision window loses the client
 * before the first call, and a double-encoding artifact (mojibake) reads as
 * garbage.
 *
 * The SCHEMA half was unmeasured, and it grew 160x larger than the prose
 * (#1337). A packaged benchmark found the 45-tool surface at 2.74 MB / about
 * 567k client-estimated tokens: a 200k-context client connected, received all
 * tools, and then failed every request before inference. The compact gateway
 * now advertises the shared type graph once: three small operating entry points
 * plus one discriminated execution tool fit in about 427 KB / 81k measured
 * cache-creation tokens on the same client, with the granular surface retained
 * as an explicit compatibility binary.
 *
 * These assertions preserve that result. The ceilings leave room for additive
 * axes in the one shared graph, but not enough to duplicate that graph into a
 * second coarse tool.
 *
 * Scenarios (one live stdio handshake):
 *
 * 1. Every tool carries a non-empty description within the 1023-character cap.
 * 2. The server instruction exists and its first 512 characters already state what
 *    the server is and how to start (the engine-enforces framing, the
 *    guide-document entry point): the inverted pyramid, not a build-up.
 * 3. No tool description and no instruction carries a double-encoding artifact.
 * 4. The total advertised schema payload is within its budget, and no single tool
 *    exceeds its own.
 * 5. The budget's TIGHTNESS is itself asserted: its remaining headroom is smaller
 *    than one more inlined `$defs` closure. A second coarse tool that repeats
 *    the type graph therefore fails without needing a hand-edited mutant in the
 *    suite.
 * 6. The schema half is still the half that costs, so the two budgets stay pointed
 *    at the right target: schemas outweigh descriptions by more than two orders
 *    of magnitude.
 */
export const test_mcp_contract_budgets = async (): Promise<void> => {
  const { client, tools } = await openMcpStdio("automovie-test");
  try {
    // 1. per-tool description budget
    for (const tool of tools) {
      TestValidator.predicate(
        `tool description present: ${tool.name}`,
        typeof tool.description === "string" &&
          tool.description.trim().length > 0,
      );
      TestValidator.predicate(
        `tool description within 1023 chars: ${tool.name} (${tool.description!.length})`,
        tool.description!.length <= 1023,
      );
    }

    // 2. the 512-character opening states the server's purpose
    const instructions = client.getInstructions();
    if (instructions === undefined)
      throw new Error("the server must ship handshake instructions");
    const opening = instructions.slice(0, 512);
    TestValidator.predicate(
      "the opening names the product and its arbiter framing",
      opening.includes("AutoMovie") &&
        opening.includes("engine enforces, model creates"),
    );
    TestValidator.predicate(
      "the opening names the guide entry point",
      opening.includes("AUTOMOVIE_OVERALL"),
    );

    // 3. no mojibake in anything shipped to the client LLM
    TestValidator.predicate(
      "the instruction carries no double-encoding artifact",
      hasDoubleEncoding(instructions) === false,
    );
    for (const tool of tools)
      TestValidator.predicate(
        `tool description is not double-encoded: ${tool.name}`,
        hasDoubleEncoding(tool.description ?? "") === false,
      );

    // 4. the payload that actually costs
    const perTool = tools.map((tool) => ({
      name: tool.name,
      chars:
        schemaChars(tool.inputSchema) +
        schemaChars((tool as { outputSchema?: unknown }).outputSchema),
    }));
    const total = perTool.reduce((sum, entry) => sum + entry.chars, 0);
    TestValidator.predicate(
      `advertised schema payload within budget (${total} <= ${SCHEMA_PAYLOAD_BUDGET})`,
      total <= SCHEMA_PAYLOAD_BUDGET,
    );
    for (const entry of perTool)
      TestValidator.predicate(
        `tool schema within budget: ${entry.name} (${entry.chars} <= ${PER_TOOL_SCHEMA_BUDGET})`,
        entry.chars <= PER_TOOL_SCHEMA_BUDGET,
      );

    // 5. the budget is tight enough to catch the growth it exists to catch.
    //     The growth mechanism is a tool inlining its own complete transitive
    //     `$defs` closure, so the guard is measured in whole closures: the
    //     largest one any tool already carries must not fit in the headroom.
    let largestClosure = 0;
    for (const tool of tools)
      for (const schema of [
        tool.inputSchema,
        (tool as { outputSchema?: unknown }).outputSchema,
      ])
        largestClosure = Math.max(largestClosure, closureChars(schema));
    const headroom = SCHEMA_PAYLOAD_BUDGET - total;
    TestValidator.predicate(
      `the budget cannot absorb another inlined closure (headroom ${headroom} < ${largestClosure})`,
      largestClosure > 0 && headroom < largestClosure,
    );

    // 6. and the budgets stay pointed at the half that costs
    const descriptionChars = tools.reduce(
      (sum, tool) => sum + (tool.description ?? "").length,
      0,
    );
    TestValidator.predicate(
      `schemas still dominate prose by two orders of magnitude (${total} vs ${descriptionChars})`,
      descriptionChars > 0 && total > descriptionChars * 100,
    );
  } finally {
    await client.close();
  }
};
