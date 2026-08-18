import {
  builtEnvironmentUnclaimedElements,
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

/**
 * Only a hierarchy root no space claims is left over for the index to name.
 *
 * Leaving an element unassigned is correct rather than careless: an exterior
 * wall, a foundation, and a structural frame belong to no room. Measured on the
 * scaffold's own `ExampleBuilding`, 9 of its 30 elements are claimed by no
 * space, and all nine are envelope or vertical-transport machinery — four
 * curtain panels, a facade ladder, a lift car, a car shell, a counterweight and
 * its block — while every floor slab, partition, door and leaf is claimed. So
 * the space tree indexes a building rather than covering it.
 *
 * What covers it is the element hierarchy, which the record says is total:
 * every element descends from exactly one unit's roots. A child therefore
 * arrives among its parent's members and a claimed element among its space's,
 * which leaves exactly one population over — a root carrying no space of its
 * own. Taking the compiled scene's drawn set as the notion of reach instead
 * named seven of `ExampleBuilding`'s envelope pieces as roots although the unit
 * root above them is claimed by a space, so the listing said they hang from
 * nothing while the record said otherwise.
 *
 * Scenarios:
 *
 * 1. A unit root no space claims is named, because nothing else lists it.
 * 2. A unit root a space claims is not named: that space lists it.
 * 3. An element with a parent is never named, whether or not a space claims it
 *    and whether or not the compiler drew its parent, because its parent lists
 *    it.
 * 4. The fixture carrying all three is a legal building, so the rule is read
 *    off a record the engine accepts rather than off an invented one.
 */
export const test_architecture_unclaimed_elements = (): void => {
  const record = environment();

  TestValidator.equals(
    "the fixture is a legal building",
    validateBuiltEnvironment({ environment: record }).success,
    true,
  );

  TestValidator.equals(
    "only a root no space claims is left over",
    builtEnvironmentUnclaimedElements(record),
    ["residence/garden-wall-root"],
  );

  TestValidator.equals(
    "every other element is named by something else",
    namedFacts([
      [
        "a root a space claims is not left over",
        () =>
          builtEnvironmentUnclaimedElements(record).includes(
            "residence/residence-root",
          ) === false,
      ],
      [
        "an unassigned element under a drawn parent is not left over",
        () =>
          builtEnvironmentUnclaimedElements(record).includes(
            "residence/wall-buttress",
          ) === false,
      ],
      [
        "an unassigned element under a group is not left over either",
        () =>
          builtEnvironmentUnclaimedElements(record).includes(
            "residence/great-hall-chair-seat",
          ) === false,
      ],
      [
        "and neither is an element a space claims outright",
        () =>
          builtEnvironmentUnclaimedElements(record).includes(
            "residence/great-hall-chair",
          ) === false,
      ],
    ]),
    {
      "a root a space claims is not left over": true,
      "an unassigned element under a drawn parent is not left over": true,
      "an unassigned element under a group is not left over either": true,
      "and neither is an element a space claims outright": true,
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
 * One residence whose two units answer the rule from both sides.
 *
 * The residence unit's root is claimed by the great hall, so the hall lists it
 * and it is not left over. The garden unit's root carries no space, so nothing
 * lists it and the index must. Both are transform-only groups, which is the
 * ordinary shape of a building root and the reason the space tree alone leaves
 * an unassigned element unreachable.
 */
const environment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "residence",
  units: "meter",
  buildings: [
    { id: "residence", element: "residence-root", space: "great-hall" },
    { id: "garden", element: "garden-wall-root", space: "garden" },
  ],
  models: [boxModel("cube-model")],
  modelReferences: [],
  elements: [
    {
      id: "residence-root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "great-hall",
    },
    {
      id: "great-hall-chair",
      kind: "furniture",
      parent: "residence-root",
      transform: place(1, 0, 0),
      model: null,
      space: "great-hall",
    },
    {
      id: "great-hall-chair-seat",
      kind: "furniture",
      parent: "great-hall-chair",
      transform: place(1, 0.5, 0),
      model: "cube-model",
      space: null,
    },
    {
      id: "outer-wall",
      kind: "wall",
      parent: "residence-root",
      transform: place(3, 0.5, 0),
      model: "cube-model",
      space: null,
    },
    {
      id: "wall-buttress",
      kind: "structure",
      parent: "outer-wall",
      transform: place(4, 0.5, 0),
      model: "cube-model",
      space: null,
    },
    {
      id: "garden-wall-root",
      kind: "building",
      parent: null,
      transform: place(10, 0, 0),
      model: null,
      space: null,
    },
    {
      id: "garden-wall",
      kind: "wall",
      parent: "garden-wall-root",
      transform: place(10, 0.5, 0),
      model: "cube-model",
      space: null,
    },
  ],
  spaces: [
    { id: "great-hall", kind: "room", parent: null, cells: [] },
    { id: "garden", kind: "room", parent: null, cells: [] },
  ],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});
