import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TestValidator } from "@nestia/e2e";

const REQUEST_OPTIONS = { timeout: 120_000 };

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

/**
 * The MCP surface's HARD prose constraints, machine-enforced (#1129). Tool
 * descriptions and the server instruction ship verbatim to client LLMs: a
 * description past the 1023-character cap truncates silently, an opening that
 * buries the server's purpose past the ~512-character decision window loses the
 * client before the first call, and a double-encoding artifact (mojibake) reads
 * as garbage. The tool INVENTORY drift alarm already lives in the stdio
 * roundtrip scenario; this pins the constraints an eyeball review cannot.
 *
 * Scenarios (one live stdio handshake):
 *
 * 1. Every tool carries a non-empty description within the 1023-character cap.
 * 2. The server instruction exists and its first 512 characters already state what
 *    the server is and how to start (the engine-enforces framing, the
 *    guide-document entry point) — the inverted pyramid, not a build-up.
 * 3. No tool description and no instruction carries a double-encoding artifact.
 */
export const test_mcp_contract_budgets = async (): Promise<void> => {
  const client = new Client({ name: "automovie-test", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: "pnpm",
    args: ["--filter", "@automovie/mcp", "start"],
  });
  await client.connect(transport, REQUEST_OPTIONS);
  try {
    const { tools } = await client.listTools(undefined, REQUEST_OPTIONS);

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
  } finally {
    await client.close();
  }
};
