import { planAutoMovieReferenceClientConfiguration } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

/**
 * Client configuration binds installed reference tools while preserving user options.
 *
 * Scenarios:
 * 1. Empty and existing configurations preserve unrelated entries and TOML bytes.
 * 2. Repeated plans are byte-identical and intact managed registration can move roots.
 * 3. Matching unmarked registration remains untouched without inventing ownership.
 */
export const test_reference_client_configuration = (): void => {
  const root = path.resolve(
    path.parse(process.cwd()).root,
    "production 한글 space",
  );
  const nodeExecutable = path.resolve(
    path.parse(process.cwd()).root,
    "tools",
    "node",
  );
  const originalJson = {
    preference: "keep",
    mcpServers: { other: { command: "other-tool", env: { KEEP: "value" } } },
  };
  const originalToml =
    "# user note\r\nmodel = 'chosen'\r\n\r\n[mcp_servers.other]\r\ncommand = 'other-tool'\r\n";
  const request = {
    root,
    nodeExecutable,
    claude: JSON.stringify(originalJson),
    codex: originalToml,
  };
  const first = planAutoMovieReferenceClientConfiguration(request);
  const claude = JSON.parse(first.claude.content);
  TestValidator.equals(
    "Claude unrelated value",
    claude.preference,
    originalJson.preference,
  );
  TestValidator.equals(
    "Claude other server",
    claude.mcpServers.other,
    originalJson.mcpServers.other,
  );
  TestValidator.equals(
    "installed command",
    claude.mcpServers.automovie_reference,
    {
      type: "stdio",
      command: nodeExecutable,
      args: [
        path.join(root, "node_modules/@automovie/mcp/lib/bin.js"),
        "--root",
        root,
      ],
    },
  );
  TestValidator.predicate(
    "TOML bytes retain prefix",
    first.codex.content.startsWith(originalToml),
  );
  const second = planAutoMovieReferenceClientConfiguration({
    root,
    nodeExecutable,
    claude: first.claude.content,
    codex: first.codex.content,
  });
  TestValidator.equals("idempotence", second, first);
  const moved = planAutoMovieReferenceClientConfiguration({
    root: path.join(root, "moved"),
    nodeExecutable,
    claude: first.claude.content,
    codex: first.codex.content,
  });
  TestValidator.predicate(
    "move preserves unrelated TOML",
    moved.codex.content.startsWith(originalToml),
  );
  TestValidator.equals(
    "move changes bound root",
    JSON.parse(moved.claude.content).mcpServers.automovie_reference.args[2],
    path.join(root, "moved"),
  );
  const blank = planAutoMovieReferenceClientConfiguration({
    root,
    nodeExecutable,
  });
  TestValidator.equals(
    "project-local candidate paths",
    [blank.claude.path, blank.codex.path],
    [".mcp.json", ".codex/config.toml"],
  );
  const unmarked = blank.codex.content
    .split("\n")
    .filter((line) => !line.startsWith("# automovie-reference managed "))
    .join("\n");
  TestValidator.equals(
    "matching unmarked table unchanged",
    planAutoMovieReferenceClientConfiguration({
      root,
      nodeExecutable,
      codex: unmarked,
    }).codex.content,
    unmarked,
  );
  const noNewline = "model = 'chosen'";
  TestValidator.predicate(
    "missing final newline separated",
    planAutoMovieReferenceClientConfiguration({
      root,
      nodeExecutable,
      codex: noNewline,
    }).codex.content.startsWith(`${noNewline}\n# automovie-reference`),
  );
  const suffix = "\n[another]\nvalue = 2\n";
  TestValidator.predicate(
    "post-block tables preserved",
    planAutoMovieReferenceClientConfiguration({
      root,
      nodeExecutable,
      codex: blank.codex.content + suffix,
    }).codex.content.endsWith(suffix),
  );
};
