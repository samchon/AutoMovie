import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const identity = loadSourceModule<{
  readAutoMovieProjectProductionId: (
    root: string,
    open: (root: string) => { productionId: string },
  ) => string;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/projectIdentity.ts",
  ),
);

/**
 * Generated commands delegate namespace selection to the project read fence.
 *
 * Scenarios:
 *
 * The wrapper forwards the exact project root and returns only the namespace
 * selected by the injected atomic project opener.
 */
export const test_cli_scaffold_project_identity = (): void => {
  TestValidator.equals(
    "generated production selection uses the atomic project owner",
    namedFacts([
      [
        "lockedOwnerSelected",
        () => {
          let received = "";
          const productionId = identity.readAutoMovieProjectProductionId(
            "C:/generated/project",
            (root) => {
              received = root;
              return { productionId: "registered-owner" };
            },
          );
          return (
            received === "C:/generated/project" &&
            productionId === "registered-owner"
          );
        },
      ],
    ]),
    {
      lockedOwnerSelected: true,
    },
  );
};
