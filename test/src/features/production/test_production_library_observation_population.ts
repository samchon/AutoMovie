import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieLibraryRequiredObservation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import {
  lFootprintBuilding,
  rectangularBuilding,
} from "../internal/envelopeFixtures";
import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, vclose } from "../internal/predicates";

/**
 * Load the derivation from source; the library review gate is its consumer.
 */
const unit = loadSourceModule<{
  autoMovieLibraryObservationRequirements: (
    environments: readonly IAutoMovieBuiltEnvironment[],
  ) => IAutoMovieLibraryRequiredObservation[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryObservationRequirements.ts",
  ),
);
const derive = unit.autoMovieLibraryObservationRequirements;

/**
 * What a building owes is counted from the building, not from a fixed number.
 *
 * A bounded object closes on nine views because it has six faces, two useful
 * diagonals, and the steep outline pass that reads the silhouette those eight
 * flatten. A building has as many elevations as it has exposed sides,
 * as many corner readings as those elevations meet at, and as many interiors as
 * it has rooms, so its population is a function of its own envelope and space
 * tree. That is what makes "complete" mean something here: an author cannot
 * enumerate a smaller building than the one it compiled.
 *
 * Two entries in the population are worth naming because nothing else supplies
 * them. The setting view is charged once per unit, since an envelope read face
 * by face never says where the work stands. And an interior station carries the
 * point it was proved to stand at, together with the room it stands in, so a
 * receipt can be checked against the room it claims rather than against a name.
 *
 * Scenarios:
 *
 * 1. The rectangular hall derives twenty-one observations: its setting, four
 *    facades, four corners, a roof, an underside, its one entrance, and the
 *    nine interior stations of its one room, in one deterministic order.
 * 2. Each exterior observation opens the building-unit aggregate and each
 *    interior one opens its own space, so the two are never confused.
 * 3. Every interior station carries a pose naming the space it stands in, and
 *    every exterior one carries none, because its framing belongs to the
 *    instrument rather than to the topology.
 * 4. The L-shaped wing charges for its re-entrant corner, which no elevation of
 *    its own shows, and its notch station stays in the population with no pose
 *    rather than leaving it.
 * 5. Two buildings in one record each charge for their own envelope.
 * 6. No environments derive no observations, which is a fact about what was
 *    compiled rather than a complete review.
 */
/** One minimal placed set; only the fields the derivation reads carry meaning. */
/** One opaque untextured material, so a case adds only what it declares. */
const material = (id: string) => ({
  id,
  name: null,
  baseColor: { r: 0.5, g: 0.5, b: 0.5, a: null, hex: null },
  metallic: 0,
  roughness: 1,
  emissive: null,
  opacity: 1,
  baseColorTexture: null,
});

/** One element wearing one model, standing in one space or nowhere. */
const element = (id: string, model: string, space: string | null) => ({
  id,
  kind: "prop",
  parent: null,
  transform: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  model,
  space,
});

const instanceSet = (id: string) => ({
  id,
  modelRecipe: `recipe-${id}`,
  count: 4,
  layout: {
    kind: "grid" as const,
    rows: 2,
    columns: 2,
    spacing: { x: 1, z: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1,
  variation: { scale: { min: 1, max: 1 }, palette: [], traits: [] },
});

export const test_production_library_observation_population = (): void => {
  const required = derive([rectangularBuilding()]);

  TestValidator.equals(
    "the rectangular hall charges for its whole envelope and its one room",
    required.map((entry) => [entry.id, entry.role]),
    [
      ["building:hall-house/house/context", "context"],
      ["building:hall-house/house/corner/wall-east+wall-north", "corner"],
      ["building:hall-house/house/corner/wall-east+wall-south", "corner"],
      ["building:hall-house/house/corner/wall-north+wall-west", "corner"],
      ["building:hall-house/house/corner/wall-south+wall-west", "corner"],
      ["building:hall-house/house/entrance/door-main", "entrance"],
      ["building:hall-house/house/facade/wall-east", "facade"],
      ["building:hall-house/house/facade/wall-north", "facade"],
      ["building:hall-house/house/facade/wall-south", "facade"],
      ["building:hall-house/house/facade/wall-west", "facade"],
      ["building:hall-house/house/roof/roof-top", "roof"],
      ["building:hall-house/house/underside/floor-slab", "underside"],
      ["space:hall-house/hall/center-x-minus", "interior-center"],
      ["space:hall-house/hall/center-x-plus", "interior-center"],
      ["space:hall-house/hall/center-z-minus", "interior-center"],
      ["space:hall-house/hall/center-z-plus", "interior-center"],
      ["space:hall-house/hall/corner-x-minus-z-minus", "interior-corner"],
      ["space:hall-house/hall/corner-x-minus-z-plus", "interior-corner"],
      ["space:hall-house/hall/corner-x-plus-z-minus", "interior-corner"],
      ["space:hall-house/hall/corner-x-plus-z-plus", "interior-corner"],
      ["space:hall-house/hall/threshold-door-main", "interior-threshold"],
    ],
  );

  TestValidator.equals(
    "an exterior observation opens the unit and an interior one opens its room",
    namedFacts([
      [
        "every exterior observation opens the building-unit aggregate",
        () =>
          required
            .filter((entry) => entry.role.startsWith("interior-") === false)
            .every(
              (entry) =>
                entry.subject === "building:hall-house/house" &&
                entry.building === "house" &&
                entry.pose === null,
            ),
      ],
      [
        "every interior observation opens its own space and stands inside it",
        () =>
          required
            .filter((entry) => entry.role.startsWith("interior-"))
            .every(
              (entry) =>
                entry.subject === "space:hall-house/hall" &&
                entry.pose !== null &&
                entry.pose.space === "hall",
            ),
      ],
      [
        "the doorway station is derived from its own opening",
        () =>
          required.find(
            (entry) => entry.id === "space:hall-house/hall/threshold-door-main",
          )?.origin === "door-main",
      ],
      [
        "and it stands one ladder step inside the room it opens onto",
        () =>
          vclose(
            required.find(
              (entry) =>
                entry.id === "space:hall-house/hall/threshold-door-main",
            )!.pose!.position,
            { x: 2, y: 1.5, z: 0.15 },
          ),
      ],
    ]),
    {
      "every exterior observation opens the building-unit aggregate": true,
      "every interior observation opens its own space and stands inside it": true,
      "the doorway station is derived from its own opening": true,
      "and it stands one ladder step inside the room it opens onto": true,
    },
  );

  const wing = derive([lFootprintBuilding()]);

  TestValidator.equals(
    "an irregular footprint charges for the elevation it hides from itself",
    namedFacts([
      [
        "the notch is charged as its own corner observation",
        () =>
          wing.some(
            (entry) =>
              entry.id === "building:l-wing/wing/corner/wall-2+wall-3" &&
              entry.role === "corner",
          ),
      ],
      [
        "six corners are charged, one for every meeting of its elevations",
        () => wing.filter((entry) => entry.role === "corner").length === 6,
      ],
      [
        "and the station in the notch stays charged with nowhere to stand",
        () =>
          wing.find(
            (entry) => entry.id === "space:l-wing/hall/corner-x-plus-z-plus",
          )?.pose === null,
      ],
    ]),
    {
      "the notch is charged as its own corner observation": true,
      "six corners are charged, one for every meeting of its elevations": true,
      "and the station in the notch stays charged with nowhere to stand": true,
    },
  );

  TestValidator.equals(
    "each unit charges for its own envelope, and nothing charges for nothing",
    namedFacts([
      [
        "two units each own their setting view",
        () =>
          derive([rectangularBuilding(), lFootprintBuilding()]).filter(
            (entry) => entry.role === "context",
          ).length === 2,
      ],
      [
        "and no compiled topology derives no observation",
        () => derive([]).length === 0,
      ],
    ]),
    {
      "two units each own their setting view": true,
      "and no compiled topology derives no observation": true,
    },
  );

  // An instance set standing in a building's space adds three questions and no
  // one of them substitutes for another: the population is the only view where
  // density and layout can be wrong, the member is the only one close enough to
  // judge the prototype being repeated, and the contact is the only one that
  // shows an instance meeting the surface it stands on.
  const placed = rectangularBuilding();
  placed.populations = [
    {
      space: "hall",
      prototypeBounds: {
        min: { x: -1, y: 0, z: -1 },
        max: { x: 1, y: 1, z: 1 },
      },
      set: instanceSet("benches"),
    },
  ];
  const stray = rectangularBuilding();
  stray.populations = [
    {
      space: "courtyard",
      prototypeBounds: {
        min: { x: -1, y: 0, z: -1 },
        max: { x: 1, y: 1, z: 1 },
      },
      set: instanceSet("planters"),
    },
  ];
  const placedRequired = derive([placed]);
  TestValidator.equals(
    "a placed instance set is judged as a population, a member, and a contact",
    {
      derived: placedRequired
        .filter((entry) => entry.role.startsWith("instance-"))
        .map((entry) => [entry.id, entry.role, entry.building, entry.origin]),
      // The building profile is untouched: adding a set asks new questions and
      // takes none away, which is the property the whole derivation exists for.
      envelope: placedRequired.length - derive([rectangularBuilding()]).length,
      // A population standing in no building's space belongs to the
      // environment rather than to a unit, and attaching it to an arbitrary
      // one would make that owner answer for placement it does not own.
      stray: derive([stray]).filter((entry) =>
        entry.role.startsWith("instance-"),
      ).length,
    },
    {
      derived: [
        [
          "instance:hall-house/benches/instance-contact",
          "instance-contact",
          "house",
          "hall",
        ],
        [
          "instance:hall-house/benches/instance-member",
          "instance-member",
          "house",
          "hall",
        ],
        [
          "instance:hall-house/benches/instance-population",
          "instance-population",
          "house",
          "hall",
        ],
      ],
      envelope: 3,
      stray: 0,
    },
  );

  // An opening that operates is judged in its own states, in the travel between
  // them, and where its leaf meets its frame. A still frame answers none of the
  // three alone: a door photographed open and closed proves nothing about the
  // arc between, and one photographed only mid-swing never says it shuts.
  const operable = rectangularBuilding();
  operable.openings[0]!.operation = {
    panels: [
      {
        id: "leaf",
        element: "house-root",
        width: 1,
        height: 2.1,
        motion: {
          kind: "revolute",
          axis: { x: 0, y: 1, z: 0 },
          pivot: { x: 1.5, y: 0, z: 0 },
          min: 0,
          max: 90,
        },
      },
    ],
    states: [
      { id: "closed", panels: [{ panel: "leaf", value: 0 }] },
      { id: "ajar", panels: [{ panel: "leaf", value: 30 }] },
      { id: "open", panels: [{ panel: "leaf", value: 90 }] },
    ],
    state: "closed",
    hardware: [],
  };
  // The same operation on a boundary that bounds no building's space -- a site
  // gate, a freestanding screen. It belongs to the environment rather than to a
  // unit, and attaching it to an arbitrary one would make that owner answer for
  // a thing it does not contain.
  const detachedGate = rectangularBuilding();
  detachedGate.boundaries.push({
    id: "gate-panel",
    kind: "gate",
    spaces: ["courtyard"],
    elements: [],
    face: {
      origin: { x: 8, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      outline: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      thickness: 0.1,
    },
  });
  detachedGate.openings.push({
    ...operable.openings[0]!,
    id: "site-gate",
    boundary: "gate-panel",
  });
  const missingBoundary = structuredClone(operable);
  missingBoundary.openings[0]!.boundary = "missing-boundary";

  const operableRequired = derive([operable]);
  TestValidator.equals(
    "an operable opening is judged in its states, its travels, and its contact",
    {
      derived: operableRequired
        .filter((entry) => entry.role.startsWith("operation-"))
        .map((entry) => [entry.id, entry.role]),
      // Three states and two travels between them, not three states and three
      // pairs: the states are declared in the order the opening passes through
      // them, so charging every combination would ask for a swing from closed
      // to closed and read as thoroughness.
      detached: derive([detachedGate]).filter((entry) =>
        entry.subject.includes("site-gate"),
      ).length,
      missingBoundary: derive([missingBoundary]).filter((entry) =>
        entry.role.startsWith("operation-"),
      ).length,
      transitions: operableRequired.filter(
        (entry) => entry.role === "operation-transition",
      ).length,
      // The building profile is untouched. A fixed cut declares no operation
      // and is passed over rather than charged an empty state, which is what
      // the unmodified fixture proves by deriving none of these at all.
      fixed: derive([rectangularBuilding()]).filter((entry) =>
        entry.role.startsWith("operation-"),
      ).length,
    },
    {
      derived: [
        [
          "operation:hall-house/door-main/house/operation-contact/leaf",
          "operation-contact",
        ],
        [
          "operation:hall-house/door-main/house/operation-state/ajar",
          "operation-state",
        ],
        [
          "operation:hall-house/door-main/house/operation-state/closed",
          "operation-state",
        ],
        [
          "operation:hall-house/door-main/house/operation-state/open",
          "operation-state",
        ],
        [
          "operation:hall-house/door-main/house/operation-transition/ajar->open",
          "operation-transition",
        ],
        [
          "operation:hall-house/door-main/house/operation-transition/closed->ajar",
          "operation-transition",
        ],
      ],
      detached: 0,
      missingBoundary: 0,
      transitions: 2,
      fixed: 0,
    },
  );

  // A material is reached through the element that wears it: the element stands
  // in a space, the space belongs to a unit, and the model it wears carries the
  // surfaces that unit shows. What each material owes is read off its own
  // declaration, so a flat opaque panel owes one observation and a lit pane
  // below full opacity wearing a normal map owes four.
  const surfaced = rectangularBuilding();
  surfaced.models = [
    {
      id: "pane",
      name: null,
      origin: "generated",
      skeleton: null,
      materials: [
        material("plaster"),
        {
          ...material("glass"),
          emissive: { r: 0.1, g: 0.1, b: 0.1, a: null, hex: null },
          opacity: 0.4,
          normalTexture: "tex-normal",
        },
      ],
      parts: [],
      asset: null,
      body: null,
    },
  ];
  surfaced.elements = [
    element("pane-a", "pane", "hall"),
    // The same model in the same building twice. One surface is one thing to
    // look at, and charging it per placement would fill the denominator with
    // repeats of the same answer.
    element("pane-b", "pane", "hall"),
    // Worn by nothing that stands anywhere, so it is skipped rather than
    // attributed to a unit that does not show it.
    element("pane-loose", "pane", null),
  ];
  const unplaced = rectangularBuilding();
  unplaced.models = surfaced.models;
  unplaced.elements = [element("pane-c", "pane", "courtyard")];

  const surfacedRequired = derive([surfaced]);
  TestValidator.equals(
    "a material is charged for exactly what it declares about itself",
    {
      derived: surfacedRequired
        .filter((entry) => entry.role.startsWith("material-"))
        .map((entry) => [entry.id, entry.role, entry.building]),
      // Adding surfaces asks new questions and takes none away.
      envelope:
        surfacedRequired.length - derive([rectangularBuilding()]).length,
      unplaced: derive([unplaced]).filter((entry) =>
        entry.role.startsWith("material-"),
      ).length,
    },
    {
      derived: [
        [
          "material:hall-house/pane/glass/material-emission/glass",
          "material-emission",
          "house",
        ],
        [
          "material:hall-house/pane/glass/material-response/glass",
          "material-response",
          "house",
        ],
        [
          "material:hall-house/pane/glass/material-texture/normal",
          "material-texture",
          "house",
        ],
        [
          "material:hall-house/pane/glass/material-transmission/glass",
          "material-transmission",
          "house",
        ],
        [
          "material:hall-house/pane/plaster/material-response/plaster",
          "material-response",
          "house",
        ],
      ],
      envelope: 5,
      unplaced: 0,
    },
  );

  // A connector is the systems branch's own coupled subject. Its landings are
  // where a carriage meets a floor, which is the failure neither a route
  // drawing nor a state still can show.
  const served = rectangularBuilding();
  served.connectors = [
    {
      id: "lift",
      kind: "lift",
      from: "hall",
      to: "hall",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 3, z: 0 },
      ],
      elements: [],
      landings: [
        { space: "hall", at: 0 },
        { space: "hall", at: 1 },
      ],
      operation: {
        carriages: [
          {
            id: "car",
            element: "car-box",
            motion: {
              kind: "prismatic",
              axis: { x: 0, y: 1, z: 0 },
              min: 0,
              max: 3,
            },
          },
        ],
        states: [
          { id: "lower", carriages: [], drive: "still" },
          { id: "rising", carriages: [], drive: "forward" },
          { id: "upper", carriages: [], drive: "still" },
        ],
        state: "lower",
      },
    },
  ];
  // A stair declares no operation and names no landings. It still joins two
  // spaces, and those two ends are the landings it has.
  const stepped = rectangularBuilding();
  stepped.connectors = [
    {
      id: "stair",
      kind: "stair",
      from: "hall",
      to: "hall",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 3, z: 0 },
      ],
      elements: [],
    },
  ];
  // Joining no building's space, so it is skipped rather than attributed to a
  // unit that does not serve it.
  const detached = rectangularBuilding();
  detached.connectors = [
    {
      id: "path",
      kind: "ramp",
      from: "courtyard",
      to: "lane",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
      ],
      elements: [],
    },
  ];

  const servedRequired = derive([served]);
  TestValidator.equals(
    "a connector is judged at every landing, state, adjacency, and carriage",
    {
      derived: servedRequired
        .filter((entry) => entry.role.startsWith("service-"))
        .map((entry) => [entry.id, entry.role, entry.building]),
      envelope: servedRequired.length - derive([rectangularBuilding()]).length,
      // A stair has no states and no carriages and still owes its two ends.
      stair: derive([stepped])
        .filter((entry) => entry.role.startsWith("service-"))
        .map((entry) => entry.id),
      detached: derive([detached]).filter((entry) =>
        entry.role.startsWith("service-"),
      ).length,
    },
    {
      derived: [
        [
          "service:hall-house/lift/house/service-carriage/car",
          "service-carriage",
          "house",
        ],
        [
          "service:hall-house/lift/house/service-landing/hall@0",
          "service-landing",
          "house",
        ],
        [
          "service:hall-house/lift/house/service-landing/hall@1",
          "service-landing",
          "house",
        ],
        [
          "service:hall-house/lift/house/service-state/lower",
          "service-state",
          "house",
        ],
        [
          "service:hall-house/lift/house/service-state/rising",
          "service-state",
          "house",
        ],
        [
          "service:hall-house/lift/house/service-state/upper",
          "service-state",
          "house",
        ],
        [
          "service:hall-house/lift/house/service-transition/lower->rising",
          "service-transition",
          "house",
        ],
        [
          "service:hall-house/lift/house/service-transition/rising->upper",
          "service-transition",
          "house",
        ],
      ],
      envelope: 8,
      stair: [
        "service:hall-house/stair/house/service-landing/hall@from",
        "service:hall-house/stair/house/service-landing/hall@to",
      ],
      detached: 0,
    },
  );
};
