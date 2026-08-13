import {
  builtEnvironmentElementBounds,
  builtEnvironmentSpaceContentBounds,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts, vclose } from "../internal/predicates";

const place = (
  x: number,
  y: number,
  z: number,
  scale: IAutoMovieVector3 = { x: 1, y: 1, z: 1 },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale,
});

const unitBox = (id: string): IAutoMovieModel => ({
  ...makeProp([
    primitivePart("block", { type: "box", width: 1, height: 1, depth: 1 }),
  ]),
  id,
});

/**
 * A work whose members are unit boxes at whole-metre placements.
 *
 * Every expected bound is the unit box's own half-metre reach, scaled by the
 * element's declared scale and carried down the parent chain by hand.
 */
const work = (doorState = "closed"): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "work",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "place" }],
  models: [unitBox("stone")],
  modelReferences: ["vault-mesh"],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "place",
    },
    {
      // A grouping node that draws nothing and also offsets its child, so the
      // parent chain is exercised by the same fixture that pins the null.
      id: "wing",
      kind: "assembly",
      parent: "root",
      transform: place(10, 0, 0),
      model: null,
      space: "place",
    },
    {
      id: "chest",
      kind: "furniture",
      parent: "wing",
      transform: place(2, 0.5, 3, { x: 2, y: 1, z: 4 }),
      model: "stone",
      space: "place",
    },
    {
      id: "vault",
      kind: "vault",
      parent: "root",
      transform: place(4, 6, 7),
      model: "vault-mesh",
      space: "place",
    },
    {
      id: "leaf",
      kind: "door-leaf",
      parent: "root",
      transform: place(0, 1, 0),
      model: "stone",
      space: "place",
    },
  ],
  spaces: [{ id: "place", kind: "building", parent: null, cells: [] }],
  boundaries: [
    { id: "wall", kind: "wall", spaces: ["place"], elements: ["leaf"] },
  ],
  openings: [
    {
      id: "door",
      kind: "door",
      boundary: "wall",
      fill: "leaf",
      operation: {
        panels: [
          {
            id: "panel",
            element: "leaf",
            width: 1,
            height: 2,
            motion: {
              kind: "prismatic",
              axis: { x: -1, y: 0, z: 0 },
              min: 0,
              max: 0.9,
            },
          },
        ],
        states: [
          { id: "closed", panels: [{ panel: "panel", value: 0 }] },
          { id: "open", panels: [{ panel: "panel", value: 0.9 }] },
        ],
        state: doorState,
        hardware: [],
      },
    },
  ],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/**
 * One element's world box, computed once for everyone who asks it.
 *
 * "Where is this thing" is the question the medieval-residence campaign asked
 * more often than it opened the viewer, and it answered it with a probe built by
 * hand because the engine exposed no way to ask. This is that answer, and it is
 * deliberately the only one: placement validation resolves an element locator
 * here, subject description reports an element's extent from here, and the
 * space fold measures its own elements through the same private placement and
 * tessellation this calls, so a second implementation would be a second truth.
 *
 * Every expected bound is hand arithmetic over a unit box, never a transcript of
 * the query's own output.
 *
 * Scenarios:
 *
 * 1. The record validates, so nothing below is read off a malformed building.
 * 2. A placed element is its geometry's world box, its parent chain and its own
 *    scale included: the chest is a unit box scaled (2, 1, 4) at (2, 0.5, 3)
 *    under a wing standing at x 10, so it fills x 11..13, y 0..1, z 1..5.
 * 3. A transform-only element answers `null` rather than a point box at its
 *    origin. It draws nothing, which is the same reason a room's content bounds
 *    leaves it out, and a point box would be indistinguishable from a real
 *    member standing there.
 * 4. An id the record never declared answers `null` rather than throwing. The
 *    caller is resolving a locator project source authored, so an unresolved
 *    locator is that caller's finding to report.
 * 5. An element citing a runtime model reference the record does not own is a
 *    degenerate box at its own world origin, which is the one place the record
 *    does state.
 * 6. The box is where the current operating state puts a member, not where it
 *    was authored: opening the sliding leaf 0.9 m moves its box by exactly that,
 *    and the closed box is its authored place.
 * 7. The element answers and the space fold agree: the union of every element's
 *    own box is the space's content bounds, so the two are one computation
 *    rather than two that could drift.
 */
export const test_architecture_built_environment_element_bounds = (): void => {
  const closed = work();
  TestValidator.equals(
    "the record validates",
    validateBuiltEnvironment({ environment: closed }).success,
    true,
  );

  const chest = builtEnvironmentElementBounds(closed, "chest");
  TestValidator.equals(
    "a placed element carries its parent chain and its own scale",
    namedFacts([
      ["measured", () => chest !== null],
      ["min", () => chest !== null && vclose(chest.min, { x: 11, y: 0, z: 1 })],
      ["max", () => chest !== null && vclose(chest.max, { x: 13, y: 1, z: 5 })],
    ]),
    { measured: true, min: true, max: true },
  );

  TestValidator.equals(
    "what draws nothing and what was never declared both answer null",
    {
      groupingNode: builtEnvironmentElementBounds(closed, "wing"),
      undeclared: builtEnvironmentElementBounds(closed, "cellar-hatch"),
    },
    { groupingNode: null, undeclared: null },
  );

  const vault = builtEnvironmentElementBounds(closed, "vault");
  TestValidator.equals(
    "a referenced model the record does not own stands at its own origin",
    namedFacts([
      ["measured", () => vault !== null],
      ["min", () => vault !== null && vclose(vault.min, { x: 4, y: 6, z: 7 })],
      ["max", () => vault !== null && vclose(vault.max, { x: 4, y: 6, z: 7 })],
    ]),
    { measured: true, min: true, max: true },
  );

  const shut = builtEnvironmentElementBounds(closed, "leaf");
  const opened = builtEnvironmentElementBounds(work("open"), "leaf");
  TestValidator.equals(
    "a leaf is measured where it rests, not where it was authored",
    namedFacts([
      ["bothMeasured", () => shut !== null && opened !== null],
      [
        "closed",
        () => shut !== null && vclose(shut.min, { x: -0.5, y: 0.5, z: -0.5 }),
      ],
      [
        "opened",
        () =>
          opened !== null && vclose(opened.min, { x: -1.4, y: 0.5, z: -0.5 }),
      ],
      [
        "movedByExactlyTheTravel",
        () =>
          shut !== null &&
          opened !== null &&
          vclose(opened.max, { x: shut.max.x - 0.9, y: 1.5, z: 0.5 }),
      ],
    ]),
    {
      bothMeasured: true,
      closed: true,
      opened: true,
      movedByExactlyTheTravel: true,
    },
  );

  const space = builtEnvironmentSpaceContentBounds(closed, "place");
  TestValidator.equals(
    "the space fold is the union of the same element answers",
    namedFacts([
      ["measured", () => space !== null && chest !== null && vault !== null],
      [
        "min",
        () => space !== null && vclose(space.min, { x: -0.5, y: 0, z: -0.5 }),
      ],
      ["max", () => space !== null && vclose(space.max, { x: 13, y: 6, z: 7 })],
    ]),
    { measured: true, min: true, max: true },
  );
};
