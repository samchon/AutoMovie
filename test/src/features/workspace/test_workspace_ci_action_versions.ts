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

/** One checked-in workflow, read as the CI configuration GitHub consumes. */
const workflow = (name: "build" | "test"): string =>
  fs.readFileSync(
    path.join(ROOT, ".github", "workflows", `${name}.yml`),
    "utf8",
  );

/** Every action reference in declaration order, including its release comment. */
const actionReferences = (document: string): string[] =>
  document
    .split(/\r?\n/u)
    .map((line) => /^\s*- uses: (.+)$/u.exec(line)?.[1] ?? null)
    .filter((reference): reference is string => reference !== null);

/** Every configured product Node version, distinct from an action's runtime. */
const nodeVersions = (document: string): string[] =>
  document
    .split(/\r?\n/u)
    .map((line) => /^\s*node-version: (.+)$/u.exec(line)?.[1] ?? null)
    .filter((version): version is string => version !== null);

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
 * 1. The Ubuntu build job uses the three approved action release commits once and
 *    in setup order, guarding moving tags and stale Node 20 generations.
 * 2. The Ubuntu and Windows test jobs each use the same three commits in setup
 *    order, guarding platform drift and a partial upgrade.
 * 3. All three setup-node calls retain `22.x`, guarding confusion between the
 *    action implementation runtime and the product runtime it installs.
 */
export const test_workspace_ci_action_versions = (): void => {
  const build = workflow("build");
  const test = workflow("test");

  TestValidator.equals(
    "build uses the approved immutable Node 24 action releases",
    actionReferences(build),
    ACTIONS,
  );
  TestValidator.equals(
    "both test jobs use the approved immutable Node 24 action releases",
    actionReferences(test),
    [...ACTIONS, ...ACTIONS],
  );
  TestValidator.equals(
    "the workflows retain the Node 22 product runtime",
    [...nodeVersions(build), ...nodeVersions(test)],
    ["22.x", "22.x", "22.x"],
  );
};
