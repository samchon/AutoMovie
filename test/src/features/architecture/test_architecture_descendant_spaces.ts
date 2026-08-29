import { builtEnvironmentDescendantSpaces } from "@automovie/engine";
import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { boxCell, originTransform } from "../internal/envelopeFixtures";
import { namedFacts, throwsError } from "../internal/predicates";

/**
 * The containment fold every space query performs, stated once.
 *
 * Six queries in this package already walk a space's descendants to answer what
 * a storey contains, what a building unit owns, which nodes stage inside it, and
 * whether a point is in it. The walk itself was module-local, so the seventh
 * caller wrote it again, and two walks over one hierarchy are two answers that
 * eventually disagree about a re-parented room. This exposes the one walk rather
 * than a second copy of it.
 *
 * Scenarios:
 *
 * 1. A root names itself and everything beneath it, at every depth.
 * 2. A leaf names only itself, so descent has a floor rather than an exception.
 * 3. An intermediate space names its own subtree and nothing above or beside it.
 * 4. The order is code-unit order rather than authored order, so two callers
 *    comparing populations compare the same list.
 * 5. A space the record does not hold is refused by name rather than answered
 *    with an empty subtree, which would read as a real room containing nothing.
 */
export const test_architecture_descendant_spaces = (): void => {
  const record = storeys();

  TestValidator.equals(
    "a root names its whole subtree in code-unit order",
    builtEnvironmentDescendantSpaces(record, "house"),
    ["attic", "gallery", "hall", "house", "upper", "wing"],
  );

  TestValidator.equals(
    "descent has a floor and a middle, and refuses what it does not hold",
    namedFacts([
      [
        "a leaf names only itself",
        () =>
          builtEnvironmentDescendantSpaces(record, "gallery").join(",") ===
          "gallery",
      ],
      [
        "an intermediate space names its own subtree alone",
        () =>
          builtEnvironmentDescendantSpaces(record, "upper").join(",") ===
          "attic,gallery,upper",
      ],
      [
        "and an absent space is refused by name",
        () =>
          throwsError(
            () => builtEnvironmentDescendantSpaces(record, "cellar"),
            ["storeys", "cellar"],
          ),
      ],
    ]),
    {
      "a leaf names only itself": true,
      "an intermediate space names its own subtree alone": true,
      "and an absent space is refused by name": true,
    },
  );
};

/**
 * One unit whose spaces nest three deep and are authored out of order.
 *
 * `wing` and `hall` sit directly under the root, `upper` above `hall`, and
 * `attic` and `gallery` above `upper`, so a fold that stopped at one level or
 * kept authored order would answer differently from this one.
 */
const storeys = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "storeys",
  units: "meter",
  buildings: [{ id: "house", element: "house-root", space: "house" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "house-root",
      kind: "building",
      parent: null,
      transform: originTransform(),
      model: null,
      space: "house",
    },
  ],
  spaces: [
    { id: "wing", kind: "zone", parent: "house", cells: [] },
    { id: "gallery", kind: "room", parent: "upper", cells: [] },
    { id: "attic", kind: "room", parent: "upper", cells: [] },
    {
      id: "house",
      kind: "building",
      parent: null,
      cells: [boxCell("shell", { x: 0, y: 0, z: 0 }, { x: 8, y: 9, z: 8 })],
    },
    { id: "upper", kind: "storey", parent: "hall", cells: [] },
    { id: "hall", kind: "storey", parent: "house", cells: [] },
  ],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});
