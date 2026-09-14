import { planAutoMovieReferenceClientConfiguration } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

type Request = Parameters<typeof planAutoMovieReferenceClientConfiguration>[0];

const refusal = (request: Request): string => {
  try {
    planAutoMovieReferenceClientConfiguration(request);
    return "success";
  } catch (error) {
    return (error as { code: string }).code;
  }
};

/**
 * A registration outlives the Node install that published it.
 *
 * Ownership is what binds an entry to this production: the generated argument
 * structure and the installed bin under one absolute root. The recorded launch
 * command is a fact about the machine that wrote the entry, so a plan updates
 * it instead of calling the toolchain's own file a user edit. Requiring it to
 * equal the running executable made registration refuse permanently whenever a
 * project was created by one Node install and synchronized by another, and
 * because reference clients are the first synchronization step, the run never
 * reached instruction publication at all.
 *
 * Scenarios:
 * 1. A Claude entry recorded under another executable is republished with the
 *    current one, and converges on what a first publication would have written,
 *    keeping unrelated values and servers; a further plan is then stable.
 * 2. The same change inside an intact managed Codex block updates that block
 *    while every byte outside it survives.
 * 3. Negative twins one property away: an entry whose args no longer launch this
 *    project's installed bin still refuses; an unmarked Codex entry from another
 *    executable is preserved rather than rewritten, because no digest there
 *    proves this toolchain wrote it; and an unmarked entry whose cwd differs
 *    beyond that machine fact still refuses.
 */
export const test_reference_client_executable_change = (): void => {
  const root = path.resolve(
    path.parse(process.cwd()).root,
    "executable change space",
  );
  const previous = path.resolve(path.parse(process.cwd()).root, "pnpm", "node");
  const current = path.resolve(
    path.parse(process.cwd()).root,
    "system",
    "node",
  );
  const original = {
    preference: "keep",
    mcpServers: { other: { command: "other-tool", env: { KEEP: "value" } } },
  };
  const prologue = "# user note\r\nmodel = 'chosen'\r\n";
  const before = planAutoMovieReferenceClientConfiguration({
    root,
    nodeExecutable: previous,
    claude: JSON.stringify(original),
    codex: prologue,
  });
  const request: Request = {
    root,
    nodeExecutable: current,
    claude: before.claude.content,
    codex: before.codex.content,
  };
  TestValidator.equals(
    "a changed executable is not an ownership conflict",
    refusal(request),
    "success",
  );
  const after = planAutoMovieReferenceClientConfiguration(request);
  const document = JSON.parse(after.claude.content);
  TestValidator.equals(
    "Claude records the current executable",
    document.mcpServers.automovie_reference,
    {
      type: "stdio",
      command: current,
      args: [
        path.join(root, "node_modules/@automovie/mcp/lib/bin.js"),
        "--root",
        root,
      ],
    },
  );
  TestValidator.equals(
    "unrelated Claude value survives the update",
    document.preference,
    original.preference,
  );
  TestValidator.equals(
    "unrelated Claude server survives the update",
    document.mcpServers.other,
    original.mcpServers.other,
  );
  TestValidator.predicate(
    "Codex bytes before the managed block survive the update",
    after.codex.content.startsWith(prologue),
  );
  TestValidator.equals(
    "the update converges on a first publication under this executable",
    after,
    planAutoMovieReferenceClientConfiguration({
      root,
      nodeExecutable: current,
      claude: JSON.stringify(original),
      codex: prologue,
    }),
  );
  TestValidator.equals(
    "the updated registration is then stable",
    planAutoMovieReferenceClientConfiguration({
      root,
      nodeExecutable: current,
      claude: after.claude.content,
      codex: after.codex.content,
    }),
    after,
  );
  TestValidator.equals(
    "an entry bound to another installed bin still refuses",
    refusal({
      root,
      nodeExecutable: current,
      claude: JSON.stringify({
        mcpServers: {
          automovie_reference: {
            ...document.mcpServers.automovie_reference,
            args: ["user.js", "--root", root],
          },
        },
      }),
    }),
    "CONFIGURATION_CONFLICT",
  );
  const unmarked = before.codex.content
    .split("\n")
    .filter((line) => !line.startsWith("# automovie-reference managed "))
    .join("\n");
  TestValidator.equals(
    "an unmarked Codex entry from another executable is preserved byte-for-byte",
    planAutoMovieReferenceClientConfiguration({
      root,
      nodeExecutable: current,
      codex: unmarked,
    }).codex.content,
    unmarked,
  );
  TestValidator.equals(
    "an unmarked Codex entry differing beyond the executable still refuses",
    refusal({
      root,
      nodeExecutable: current,
      codex: unmarked.replace(/^cwd = .+$/mu, "cwd = 'elsewhere'"),
    }),
    "CONFIGURATION_CONFLICT",
  );
};
