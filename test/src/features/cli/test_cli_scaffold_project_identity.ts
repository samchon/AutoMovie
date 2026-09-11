import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

type IRegistryObservation =
  | { kind: "absent"; hasOwnedState: boolean }
  | { kind: "invalid"; reason: string }
  | { kind: "valid"; productions: readonly string[] };

const { selectAutoMovieProjectProductionId: select } = loadSourceModule<{
  selectAutoMovieProjectProductionId: (props: {
    packageName: string;
    registry: IRegistryObservation;
  }) => { kind: "fresh-seed" | "registered"; productionId: string };
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/projectIdentity.ts",
  ),
);

/**
 * A generated project's namespace comes from its tracked registration, and a
 * package name seeds only a project that has registered nothing.
 *
 * A new clone of a production whose design records are tracked holds no
 * ignored path at all, so the tracked registry is the only thing that can name
 * its production. Every refusal must leave the registration unguessed and name
 * a recovery that can be performed: the tracked file, the ignore exception an
 * older project lacks, or explicit registration through the project API.
 *
 * Scenarios:
 *
 * 1. New clone: a valid `[film]` registry selects `film` whether the package
 *    name still matches or was renamed, and never seeds the package name.
 * 2. Fresh project: no registry and no owned state seeds the package name.
 * 3. Unregistered state: no registry beside owned state (a clone of a project
 *    that never tracked its registry) is refused toward the tracked file, its
 *    ignore exception, and explicit registration, not seeded.
 * 4. Invalid registry: the store's refusal reaches the author with the tracked
 *    file to restore.
 * 5. Empty registry: refused toward restoration or explicit registration.
 * 6. Several productions: refused with every registered id listed even when the
 *    package name equals one of them, and pointed at the explicit project API.
 */
export const test_cli_scaffold_project_identity = (): void => {
  const clone: IRegistryObservation = { kind: "valid", productions: ["film"] };
  TestValidator.equals(
    "a new clone selects its tracked registration",
    select({ packageName: "film", registry: clone }),
    { kind: "registered", productionId: "film" },
  );
  TestValidator.equals(
    "a renamed package keeps selecting the registered production",
    select({ packageName: "film-remastered", registry: clone }),
    { kind: "registered", productionId: "film" },
  );

  TestValidator.equals(
    "a project with nothing registered seeds its package name",
    select({
      packageName: "film",
      registry: { kind: "absent", hasOwnedState: false },
    }),
    { kind: "fresh-seed", productionId: "film" },
  );
  TestValidator.predicate(
    "unregistered state is refused toward the tracked registry",
    throwsError(
      () =>
        select({
          packageName: "film",
          registry: { kind: "absent", hasOwnedState: true },
        }),
      [
        "automovie/productions.json",
        "version control",
        "!automovie/productions.json",
        "AutoMovieProductionProject.open(root, productionId)",
      ],
    ),
  );

  TestValidator.predicate(
    "an invalid registry carries the store's reason and the tracked file",
    throwsError(
      () =>
        select({
          packageName: "film",
          registry: { kind: "invalid", reason: "duplicate member productions" },
        }),
      [
        "automovie/productions.json",
        "duplicate member productions",
        "version control",
      ],
    ),
  );
  TestValidator.predicate(
    "an empty registry is refused toward restoration or explicit registration",
    throwsError(
      () =>
        select({
          packageName: "film",
          registry: { kind: "valid", productions: [] },
        }),
      [
        "automovie/productions.json",
        "version control",
        "AutoMovieProductionProject.open(root, productionId)",
      ],
    ),
  );
  TestValidator.predicate(
    "several productions are refused with the whole registration listed",
    throwsError(
      () =>
        select({
          packageName: "trailer",
          registry: { kind: "valid", productions: ["film", "trailer"] },
        }),
      ["2 productions", "film, trailer", "AutoMovieProductionProject.open"],
    ),
  );
};
