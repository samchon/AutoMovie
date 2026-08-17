import {
  builtEnvironmentUnclaimedElements,
  describeAutoMovieSubject,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";
import { subjectInspectionArtifact } from "../internal/subjectInspectionFixtures";

/**
 * An element no space claims is reachable from above rather than by its key.
 *
 * Leaving an element unassigned is correct: an exterior wall, a foundation, and a
 * structural frame belong to no room. What was wrong is that the only path down
 * into a building ran through its spaces, so one measured production left 671 of
 * 3,474 elements openable only by an author who already knew the key, and a key is
 * exactly what a reviewer hunting an unknown defect does not have.
 *
 * Two halves make the path. The listing names the tops of that population, and an
 * element's own description now carries its child elements beside its parts, so a
 * walk that starts at a top reaches everything under it. A group the compiler drew
 * nothing for is transparent in both: it cannot be opened, so it is never named as
 * a top and never named as a member, and its own drawn descendants take its place.
 *
 * Scenarios:
 *
 * 1. An unassigned element under a transform-only group is a top, because nothing
 *    visible above it could list it.
 * 2. An unassigned element under a visible parent is not a top: that parent's
 *    members list it, which the description proves.
 * 3. An element a space claims is never a top, whatever its parent is.
 * 4. A description's members carry child elements and placed parts together, so a
 *    walk from a top reaches an element two levels down.
 */
export const test_architecture_unclaimed_elements = (): void => {
  const record = environment();
  const drawn = new Set([
    "yard/outer-wall",
    "yard/wall-buttress",
    "yard/hearth",
    "yard/room-shelf",
  ]);
  TestValidator.equals(
    "the fixture is a legal building",
    validateBuiltEnvironment({ environment: record }).success,
    true,
  );

  TestValidator.equals(
    "only the tops of the unclaimed population are named",
    builtEnvironmentUnclaimedElements(record, drawn),
    ["yard/outer-wall", "yard/hearth"],
  );

  const artifact = subjectInspectionArtifact();
  const castle = artifact.compiled.builtEnvironments![0]!;
  castle.elements.push(
    {
      id: "shell",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: null,
    },
    {
      id: "outer-wall",
      kind: "wall",
      parent: "shell",
      transform: place(20, 0, 0),
      model: "solar-oriel-model",
      space: null,
    },
    {
      id: "wall-buttress",
      kind: "structure",
      parent: "outer-wall",
      transform: place(20, 0, 2),
      model: "solar-oriel-model",
      space: null,
    },
  );
  artifact.compiled.scene.nodes.push(
    {
      id: "castle/outer-wall",
      model: "solar-oriel-model",
      transform: place(20, 0, 0),
      motion: null,
      pose: null,
    },
    {
      id: "castle/wall-buttress",
      model: "solar-oriel-model",
      transform: place(20, 0, 2),
      motion: null,
      pose: null,
    },
  );
  const drawnCastle = new Set(
    artifact.compiled.scene.nodes.map((node) => node.id),
  );
  const wall = describeAutoMovieSubject(artifact, "element:castle/outer-wall");

  TestValidator.equals(
    "a walk from a top reaches what hangs under it",
    namedFacts([
      [
        "the wall is the top and the buttress is not",
        () =>
          builtEnvironmentUnclaimedElements(castle, drawnCastle).join(",") ===
          "castle/outer-wall",
      ],
      [
        "the wall's members name the buttress",
        () => wall.members.items.includes("element:castle/wall-buttress"),
      ],
      [
        "and its own placed parts as well",
        () =>
          wall.members.items.some((id) =>
            id.startsWith("element-part:castle/outer-wall/"),
          ),
      ],
      [
        "the transform-only group is named by neither",
        () =>
          wall.members.items.includes("element:castle/shell") === false &&
          builtEnvironmentUnclaimedElements(castle, drawnCastle).includes(
            "castle/shell",
          ) === false,
      ],
    ]),
    {
      "the wall is the top and the buttress is not": true,
      "the wall's members name the buttress": true,
      "and its own placed parts as well": true,
      "the transform-only group is named by neither": true,
    },
  );
};

const place = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const boxModel = (id: string): IAutoMovieModel => ({
  ...makeProp([
    primitivePart(`${id}-box`, { type: "box", width: 1, height: 1, depth: 1 }),
  ]),
  id,
});

/**
 * One yard whose four visible elements answer the four questions at once.
 *
 * Every element hangs from `shell`, because the engine refuses one that belongs to
 * no building unit, and `shell` is the unit's root. It is also transform-only, so
 * it can never be opened: that is the shape a real building has, and it is why the
 * space tree alone leaves an unassigned element unreachable.
 *
 * `outer-wall` is a top, since nothing openable stands above it. `wall-buttress`
 * hangs from the wall, so the wall lists it. `hearth` is a top for the same reason
 * as the wall. `room-shelf` is claimed by the room, which lists it.
 */
const environment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "yard",
  units: "meter",
  buildings: [{ id: "yard", element: "shell", space: "room" }],
  models: [boxModel("cube-model")],
  modelReferences: [],
  elements: [
    {
      id: "shell",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: null,
    },
    {
      id: "outer-wall",
      kind: "wall",
      parent: "shell",
      transform: place(0, 0.5, 0),
      model: "cube-model",
      space: null,
    },
    {
      id: "wall-buttress",
      kind: "structure",
      parent: "outer-wall",
      transform: place(1, 0.5, 0),
      model: "cube-model",
      space: null,
    },
    {
      id: "hearth",
      kind: "equipment",
      parent: "shell",
      transform: place(3, 0.5, 0),
      model: "cube-model",
      space: null,
    },
    {
      id: "room-shelf",
      kind: "equipment",
      parent: "shell",
      transform: place(4, 0.5, 0),
      model: "cube-model",
      space: "room",
    },
  ],
  spaces: [{ id: "room", kind: "room", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});
