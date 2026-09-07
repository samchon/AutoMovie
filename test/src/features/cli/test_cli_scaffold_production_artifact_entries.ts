import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { hasProductionArtifactEntries } = loadSourceModule<{
  hasProductionArtifactEntries: (props: {
    directory: "productions" | "generated" | "renders";
    entries: readonly { name: string; isFile: boolean }[];
  }) => boolean;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/productionArtifactEntries.ts",
  ),
);

/**
 * The scaffold's render README permits first initialization without hiding a
 * render bundle or state from another production namespace.
 *
 * Scenarios:
 *
 * 1. Empty artifact roots and the regular render README have no owned state.
 * 2. A render bundle, a non-file README, or any additional entry remains state.
 * 3. The documentation exception applies only to renders, never to generated
 *    output or the production registry's namespace directory.
 */
export const test_cli_scaffold_production_artifact_entries = (): void => {
  const readme = { name: "README.md", isFile: true };
  for (const directory of ["productions", "generated", "renders"] as const)
    TestValidator.equals(
      `empty ${directory}`,
      hasProductionArtifactEntries({ directory, entries: [] }),
      false,
    );
  TestValidator.equals(
    "shipped render documentation is not a production",
    hasProductionArtifactEntries({ directory: "renders", entries: [readme] }),
    false,
  );
  for (const entries of [
    [{ name: "asset-chair", isFile: false }],
    [{ name: "frame.png", isFile: true }],
    [{ ...readme, isFile: false }],
    [readme, { name: "asset-chair", isFile: false }],
  ])
    TestValidator.equals(
      "actual render entries retain orphan protection",
      hasProductionArtifactEntries({ directory: "renders", entries }),
      true,
    );
  for (const directory of ["productions", "generated"] as const)
    TestValidator.equals(
      `${directory} does not reserve a README`,
      hasProductionArtifactEntries({ directory, entries: [readme] }),
      true,
    );
};
