import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const ACTIONS = [
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
  "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6.0.9",
] as const;

interface IActionStep {
  reference: string;
  nodeVersion: string | null;
}

/** One checked-in workflow, read as the CI configuration GitHub consumes. */
const workflow = (name: "build" | "test"): string =>
  fs.readFileSync(
    path.join(ROOT, ".github", "workflows", `${name}.yml`),
    "utf8",
  );

/** Leading spaces in one workflow line. */
const indentation = (line: string): number =>
  line.length - line.trimStart().length;

/**
 * Every action step, preserving the `with.node-version` that belongs to it.
 *
 * A direct `- uses:` step and a named step with a sibling `uses:` key are both
 * valid workflow forms. Read job `steps:` blocks instead of searching the whole
 * document, so a setup-node version cannot be borrowed from another action.
 */
export const actionSteps = (document: string): IActionStep[] => {
  const lines = document.split(/\r?\n/u);
  const output: IActionStep[] = [];
  for (let index = 0; index < lines.length; ++index) {
    const declaration = lines[index]!;
    if (declaration.trim() !== "steps:") continue;
    const declarationIndent = indentation(declaration);
    const stepIndent = declarationIndent + 2;
    const blocks: string[][] = [];
    let block: string[] | null = null;
    for (const line of lines.slice(index + 1)) {
      const body = line.trimStart();
      if (
        body !== "" &&
        body.startsWith("#") === false &&
        indentation(line) <= declarationIndent
      )
        break;
      if (indentation(line) === stepIndent && body.startsWith("- ")) {
        if (block !== null) blocks.push(block);
        block = [line];
      } else if (block !== null) block.push(line);
    }
    if (block !== null) blocks.push(block);

    for (const step of blocks) {
      const references = step.flatMap((line) => {
        const body = line.trimStart();
        if (indentation(line) === stepIndent && body.startsWith("- uses: "))
          return [body.slice("- uses: ".length)];
        if (indentation(line) === stepIndent + 2 && body.startsWith("uses: "))
          return [body.slice("uses: ".length)];
        return [];
      });
      if (references.length === 0) continue;
      if (references.length !== 1)
        throw new Error("A workflow step declares more than one action.");
      const withIndex = step.findIndex(
        (line) =>
          indentation(line) === stepIndent + 2 && line.trim() === "with:",
      );
      const withRest = withIndex === -1 ? [] : step.slice(withIndex + 1);
      const withEnd = withRest.findIndex(
        (line) =>
          line.trim() !== "" &&
          line.trimStart().startsWith("#") === false &&
          indentation(line) <= stepIndent + 2,
      );
      const withBlock = withEnd === -1 ? withRest : withRest.slice(0, withEnd);
      const nodeVersion =
        withBlock
          .find(
            (line) =>
              indentation(line) === stepIndent + 4 &&
              line.trimStart().startsWith("node-version: "),
          )
          ?.trimStart()
          .slice("node-version: ".length) ?? null;
      output.push({ reference: references[0]!, nodeVersion });
    }
  }
  return output;
};

/** The approved three-step setup, with product Node attached to setup-node. */
const expectedActionSteps = (): IActionStep[] =>
  ACTIONS.map((reference) => ({
    reference,
    nodeVersion: reference.startsWith("actions/setup-node@") ? "22.x" : null,
  }));

/**
 * The CI actions use immutable, Node 24-native releases while the product stays
 * on its declared Node 22 runtime.
 *
 * GitHub can temporarily force a Node 20 action to run under Node 24, but that
 * fallback is a runner migration aid rather than a repository contract. Exact
 * release SHAs make the implementation runtime and supply-chain identity part
 * of the reviewed workflow, while the adjacent tag comments keep them
 * readable.
 *
 * Scenarios:
 *
 * 1. A parser probe reads direct and named action steps and keeps each
 *    `node-version` with its own `with:` block, guarding silent omissions and a
 *    version borrowed from another step.
 * 2. The Ubuntu build job uses the three approved action release commits once and
 *    in setup order, guarding moving tags and stale Node 20 generations.
 * 3. The Ubuntu and Windows test jobs each use the same three commits in setup
 *    order, guarding platform drift and a partial upgrade.
 * 4. All three setup-node calls retain `22.x`, guarding confusion between the
 *    action implementation runtime and the product runtime it installs.
 */
export const test_workspace_ci_action_versions = (): void => {
  const build = workflow("build");
  const test = workflow("test");

  TestValidator.equals(
    "the parser preserves named actions and step-local Node versions",
    actionSteps(
      [
        "jobs:",
        "  Probe:",
        "    steps:",
        "      - name: Legacy checkout",
        "        uses: actions/checkout@v4",
        "      - uses: actions/setup-node@v4",
        "      - uses: example/other@v1",
        "        with:",
        "          node-version: 22.x",
      ].join("\n"),
    ),
    [
      { reference: "actions/checkout@v4", nodeVersion: null },
      { reference: "actions/setup-node@v4", nodeVersion: null },
      { reference: "example/other@v1", nodeVersion: "22.x" },
    ],
  );
  TestValidator.equals(
    "build uses the approved immutable Node 24 action setup",
    actionSteps(build),
    expectedActionSteps(),
  );
  TestValidator.equals(
    "both test jobs use the approved immutable Node 24 action setup",
    actionSteps(test),
    [...expectedActionSteps(), ...expectedActionSteps()],
  );
};
