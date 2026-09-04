import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

const identity = loadSourceModule<{
  selectAutoMovieProjectProductionId: (props: {
    packageName: string;
    registered: readonly string[] | null;
    hasOwnedState: boolean;
  }) => { kind: "fresh-seed" | "registered"; productionId: string };
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/projectIdentity.ts",
  ),
);

/**
 * Package identity seeds only a fresh generated production namespace.
 *
 * Scenarios:
 *
 * 1. A fresh project uses the current package name as its initial seed.
 * 2. One registered production remains authoritative across an ordinary package rename.
 * 3. Missing-registry state, an empty registry, and a multi-production registry refuse implicit selection.
 */
export const test_cli_scaffold_project_identity = (): void => {
  TestValidator.equals(
    "generated production selection preserves the stable registry owner",
    namedFacts([
      [
        "freshUsesPackageSeed",
        () =>
          JSON.stringify(
            identity.selectAutoMovieProjectProductionId({
              packageName: "B",
              registered: null,
              hasOwnedState: false,
            }),
          ) === '{"kind":"fresh-seed","productionId":"B"}',
      ],
      [
        "renameKeepsRegisteredOwner",
        () =>
          JSON.stringify(
            identity.selectAutoMovieProjectProductionId({
              packageName: "B",
              registered: ["A"],
              hasOwnedState: true,
            }),
          ) === '{"kind":"registered","productionId":"A"}',
      ],
      [
        "orphanStateRefused",
        () =>
          throwsError(
            () =>
              identity.selectAutoMovieProjectProductionId({
                packageName: "B",
                registered: null,
                hasOwnedState: true,
              }),
            "state exists without a valid registry",
          ),
      ],
      [
        "emptyRegistryRefused",
        () =>
          throwsError(
            () =>
              identity.selectAutoMovieProjectProductionId({
                packageName: "B",
                registered: [],
                hasOwnedState: true,
              }),
            "registry is empty",
          ),
      ],
      [
        "multipleProductionsRefused",
        () =>
          throwsError(
            () =>
              identity.selectAutoMovieProjectProductionId({
                packageName: "B",
                registered: ["A", "B"],
                hasOwnedState: true,
              }),
            "require an explicit production selection",
          ),
      ],
    ]),
    {
      freshUsesPackageSeed: true,
      renameKeepsRegisteredOwner: true,
      orphanStateRefused: true,
      emptyRegistryRefused: true,
      multipleProductionsRefused: true,
    },
  );
};
