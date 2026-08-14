import {
  builtEnvironmentPlacementBounds,
  builtEnvironmentPlacementOverlap,
  builtEnvironmentSupportStatus,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  AutoMovieBuiltPlacementBodyLocator,
  AutoMovieBuiltPlacementSupportLocator,
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";

const place = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const boxModel = (
  id: string,
  width: number,
  height: number,
  depth: number,
): IAutoMovieModel => ({
  ...makeProp([
    primitivePart(`${id}-box`, { type: "box", width, height, depth }),
  ]),
  id,
});

const environment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "placement-house",
  units: "meter",
  buildings: [{ id: "house", element: "root", space: "whole" }],
  models: [
    boxModel("slab-model", 4, 1, 4),
    boxModel("cube-model", 1, 1, 1),
    boxModel("ceiling-model", 4, 0.5, 4),
  ],
  modelReferences: ["external-model"],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "whole",
    },
    {
      id: "slab",
      kind: "slab",
      parent: "root",
      transform: place(0, 0.5, 0),
      model: "slab-model",
      space: "whole",
    },
    {
      id: "resting",
      kind: "equipment",
      parent: "root",
      transform: place(0, 1.5, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "floating",
      kind: "equipment",
      parent: "root",
      transform: place(0, 1.75, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "sunk",
      kind: "equipment",
      parent: "root",
      transform: place(0, 1.25, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "off-support",
      kind: "equipment",
      parent: "root",
      transform: place(5, 1.5, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "overlap-neighbour",
      kind: "equipment",
      parent: "root",
      transform: place(0.5, 1.5, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "touch-neighbour",
      kind: "equipment",
      parent: "root",
      transform: place(1, 1.5, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "chandelier",
      kind: "chandelier",
      parent: "root",
      transform: place(0, 3, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "population-resting",
      kind: "attachment",
      parent: "root",
      transform: place(0, 2.5, 4),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "ceiling",
      kind: "ceiling",
      parent: "root",
      transform: place(0, 5, 0),
      model: "ceiling-model",
      space: "whole",
    },
    {
      id: "external",
      kind: "external-fixture",
      parent: "root",
      transform: place(0, 1, 0),
      model: "external-model",
      space: "whole",
    },
  ],
  populations: [
    {
      space: "whole",
      prototypeBounds: {
        min: { x: -0.5, y: 0, z: -0.5 },
        max: { x: 0.5, y: 1, z: 0.5 },
      },
      set: {
        id: "flags",
        modelRecipe: "flag-recipe",
        count: 3,
        layout: {
          kind: "grid",
          rows: 1,
          columns: 3,
          spacing: { x: 1, z: 1 },
        },
        anchor: { x: 0, y: 1, z: 4 },
        facingDeg: 0,
        seed: 1930,
        variation: {
          scale: { min: 1, max: 1 },
          palette: ["#808080"],
          traits: [],
        },
      },
    },
  ],
  spaces: [{ id: "whole", kind: "building", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [
    {
      space: "whole",
      surface: {
        id: "floor-surface",
        kind: "floor",
        polygon: [
          { x: -2, y: 0, z: -2 },
          { x: 2, y: 0, z: -2 },
          { x: 2, y: 0, z: 2 },
          { x: -2, y: 0, z: 2 },
        ],
        height: { kind: "constant", value: 1 },
      },
    },
  ],
  walkable: [],
});

const body = (
  kind: AutoMovieBuiltPlacementBodyLocator["kind"],
  id: string,
): AutoMovieBuiltPlacementBodyLocator =>
  kind === "element" ? { kind, id } : { kind, id };

const support = (
  kind: AutoMovieBuiltPlacementSupportLocator["kind"],
  id: string,
): AutoMovieBuiltPlacementSupportLocator => {
  switch (kind) {
    case "element":
      return { kind, id };
    case "population":
      return { kind, id };
    case "surface":
      return { kind, id };
  }
};

/**
 * Building placement review reuses authored geometry and compact population
 * bounds instead of asking a reviewer to infer support from rendered pixels.
 *
 * Scenarios:
 *
 * 1. An environment-owned element and a compact three-member population return
 *    hand-derived world boxes and preserve their different measurement bases.
 * 2. A missing element and a transform-only group remain unresolved, while an
 *    element citing a runtime model reference resolves to the one world origin
 *    the record does state and labels that box `element-origin-point`.
 * 3. Bearing against an element and an authored surface classifies exact
 *    contact, positive gap, penetration, no planar support, and the exact
 *    tolerance boundary; omitted tolerance takes the deterministic default.
 * 4. A declared chandelier suspension is legitimate only when both its body
 *    and named ceiling resolve; every subject/support unresolved combination
 *    reports the exact missing side and retains the basis of the side it knows.
 * 5. Negative and non-finite tolerances are refused rather than silently
 *    changing the meaning of contact.
 * 6. Named-neighbour bounds distinguish positive-volume overlap, exact face
 *    contact, separation, conservative population involvement, and unresolved
 *    operands without expanding population members.
 * 7. An extent-free body is never silently confused with a measured one: it
 *    bears from its origin and clears its neighbour, and both answers carry the
 *    basis that says no volume was measured.
 */
export const test_architecture_built_environment_placement = (): void => {
  const source = environment();
  TestValidator.equals(
    "the authored environment is valid",
    validateBuiltEnvironment({ environment: source }).success,
    true,
  );

  TestValidator.equals(
    "element world bounds",
    builtEnvironmentPlacementBounds({
      environment: source,
      target: body("element", "resting"),
    }),
    {
      min: { x: -0.5, y: 1, z: -0.5 },
      max: { x: 0.5, y: 2, z: 0.5 },
      basis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "compact population world bounds",
    builtEnvironmentPlacementBounds({
      environment: source,
      target: body("population", "flags"),
    }),
    {
      min: { x: -1.5, y: 1, z: 3.5 },
      max: { x: 1.5, y: 2, z: 4.5 },
      basis: "population-placement-bounds",
    },
  );
  TestValidator.equals(
    "unknown element has no invented bounds",
    builtEnvironmentPlacementBounds({
      environment: source,
      target: body("element", "missing"),
    }),
    null,
  );
  TestValidator.equals(
    "transform-only element has no invented bounds",
    builtEnvironmentPlacementBounds({
      environment: source,
      target: body("element", "root"),
    }),
    null,
  );
  TestValidator.equals(
    "referenced model without local geometry is its stated origin point",
    builtEnvironmentPlacementBounds({
      environment: source,
      target: body("element", "external"),
    }),
    {
      min: { x: 0, y: 1, z: 0 },
      max: { x: 0, y: 1, z: 0 },
      basis: "element-origin-point",
    },
  );
  TestValidator.equals(
    "unknown population has no invented bounds",
    builtEnvironmentPlacementBounds({
      environment: source,
      target: body("population", "missing"),
    }),
    null,
  );
  const unpopulated = environment();
  delete unpopulated.populations;
  TestValidator.equals(
    "a record declaring no populations at all resolves none",
    builtEnvironmentPlacementBounds({
      environment: unpopulated,
      target: body("population", "flags"),
    }),
    null,
  );

  const bearing = (
    subjectId: string,
    target: AutoMovieBuiltPlacementSupportLocator = support("element", "slab"),
    tolerance?: number,
  ) =>
    builtEnvironmentSupportStatus({
      environment: source,
      query: {
        subject: body("element", subjectId),
        support: target,
        kind: "bearing",
        ...(tolerance === undefined ? {} : { tolerance }),
      },
    });
  TestValidator.equals("resting on element support", bearing("resting"), {
    status: "resting",
    gap: 0,
    unresolved: [],
    subjectBasis: "element-geometry-bounds",
    supportBasis: "element-geometry-bounds",
  });
  TestValidator.equals("floating above element support", bearing("floating"), {
    status: "floating",
    gap: 0.25,
    unresolved: [],
    subjectBasis: "element-geometry-bounds",
    supportBasis: "element-geometry-bounds",
  });
  TestValidator.equals("sunk into element support", bearing("sunk"), {
    status: "sunk",
    gap: -0.25,
    unresolved: [],
    subjectBasis: "element-geometry-bounds",
    supportBasis: "element-geometry-bounds",
  });
  TestValidator.equals(
    "element standing outside named support",
    bearing("off-support"),
    {
      status: "not-over-support",
      gap: null,
      unresolved: [],
      subjectBasis: "element-geometry-bounds",
      supportBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "exact tolerance boundary is resting",
    bearing("floating", support("element", "slab"), 0.25),
    {
      status: "resting",
      gap: 0.25,
      unresolved: [],
      subjectBasis: "element-geometry-bounds",
      supportBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "authored support surface uses its height rule",
    bearing("resting", support("surface", "floor-surface")),
    {
      status: "resting",
      gap: 0,
      unresolved: [],
      subjectBasis: "element-geometry-bounds",
      supportBasis: "surface-height-rule",
    },
  );
  TestValidator.equals(
    "compact population can be the named support without expansion",
    bearing("population-resting", support("population", "flags")),
    {
      status: "resting",
      gap: 0,
      unresolved: [],
      subjectBasis: "element-geometry-bounds",
      supportBasis: "population-placement-bounds",
    },
  );

  TestValidator.equals(
    "a body the record carries no vertices for is probed as its origin",
    bearing("external"),
    {
      status: "resting",
      gap: 0,
      unresolved: [],
      subjectBasis: "element-origin-point",
      supportBasis: "element-geometry-bounds",
    },
  );

  TestValidator.equals(
    "authored chandelier suspension",
    builtEnvironmentSupportStatus({
      environment: source,
      query: {
        subject: body("element", "chandelier"),
        support: support("element", "ceiling"),
        kind: "suspended",
      },
    }),
    {
      status: "suspended",
      gap: null,
      unresolved: [],
      subjectBasis: "element-geometry-bounds",
      supportBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "unresolved subject retains support basis",
    bearing("missing"),
    {
      status: "unresolved",
      gap: null,
      unresolved: ["subject"],
      subjectBasis: null,
      supportBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "unresolved support retains subject basis",
    bearing("resting", support("surface", "missing")),
    {
      status: "unresolved",
      gap: null,
      unresolved: ["support"],
      subjectBasis: "element-geometry-bounds",
      supportBasis: null,
    },
  );
  TestValidator.equals(
    "both unresolved sides are named in stable order",
    bearing("missing", support("element", "missing")),
    {
      status: "unresolved",
      gap: null,
      unresolved: ["subject", "support"],
      subjectBasis: null,
      supportBasis: null,
    },
  );
  const degenerate = environment();
  degenerate.surfaces[0]!.surface.polygon = [];
  TestValidator.equals(
    "surface with no measurable face is unresolved",
    builtEnvironmentSupportStatus({
      environment: degenerate,
      query: {
        subject: body("element", "resting"),
        support: support("surface", "floor-surface"),
        kind: "bearing",
      },
    }).status,
    "unresolved",
  );
  TestValidator.error("negative tolerance is refused", () =>
    bearing("resting", support("element", "slab"), -1),
  );
  TestValidator.error("non-finite tolerance is refused", () =>
    bearing("resting", support("element", "slab"), Infinity),
  );

  const overlap = (left: string, right: string) =>
    builtEnvironmentPlacementOverlap({
      environment: source,
      left: body("element", left),
      right: body("element", right),
    });
  TestValidator.equals(
    "positive-volume neighbour overlap",
    overlap("resting", "overlap-neighbour"),
    {
      status: "overlapping",
      unresolved: [],
      leftBasis: "element-geometry-bounds",
      rightBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "exact face contact is not overlap",
    overlap("resting", "touch-neighbour"),
    {
      status: "separate",
      unresolved: [],
      leftBasis: "element-geometry-bounds",
      rightBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "separated neighbours",
    overlap("resting", "off-support"),
    {
      status: "separate",
      unresolved: [],
      leftBasis: "element-geometry-bounds",
      rightBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "population overlap preserves conservative basis",
    builtEnvironmentPlacementOverlap({
      environment: source,
      left: body("population", "flags"),
      right: body("element", "off-support"),
    }),
    {
      status: "separate",
      unresolved: [],
      leftBasis: "population-placement-bounds",
      rightBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "an extent-free operand clears its neighbour under a disclosed basis",
    overlap("external", "resting"),
    {
      status: "separate",
      unresolved: [],
      leftBasis: "element-origin-point",
      rightBasis: "element-geometry-bounds",
    },
  );
  TestValidator.equals(
    "both unresolved overlap operands are named",
    builtEnvironmentPlacementOverlap({
      environment: source,
      left: body("element", "missing-left"),
      right: body("population", "missing-right"),
    }),
    {
      status: "unresolved",
      unresolved: ["left", "right"],
      leftBasis: null,
      rightBasis: null,
    },
  );
};
