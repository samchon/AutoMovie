import {
  deriveAutoMovieDrawing,
  resolveAutoMovieDrawingFeature,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawingFeature,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  drawingEnvironment,
  drawingPlace,
  drawingView,
} from "../internal/drawingFixtures";
import { namedFacts, nclose, vclose } from "../internal/predicates";

/**
 * A dimension follows the wall it is pinned to, or says out loud that it no
 * longer knows which wall that is.
 *
 * The fixture wall is a 6 x 3 x 0.2 box, so its welded geometry has 8 corners,
 * 18 edges (twelve of the box and six face diagonals) and 12 triangles. Those
 * counts are what a pinned target is checked against, and they are hand
 * arithmetic over the engine's own box tessellation rather than numbers read
 * back out of the resolver.
 *
 * The two outcomes below are the whole contract. A target re-resolves against
 * changed geometry, so moving a wall moves its dimension and changes its
 * number; and a target whose feature count changed is stale, so replacing a
 * wall with a differently shaped one is reported rather than silently relocated
 * onto whichever feature inherited the index. A number that still looks right
 * is the only wrong answer.
 *
 * Scenarios:
 *
 * 1. Vertex, edge, face, axis and centroid each resolve to the exact world
 *    position the fixture's dimensions imply.
 * 2. Moving the wall re-resolves every target to its new place and changes the
 *    dimension's value; the drawing's digest changes with it.
 * 3. A target authored against a different feature count is stale even though its
 *    index is still in range, and the reason names both counts.
 * 4. An index out of range, a fractional index, a bad axis index, a non-zero
 *    centroid index and a mismatched axis or centroid count are each stale at
 *    their own message.
 * 5. A missing element, an element with no model, a runtime model the design does
 *    not carry, a missing part and a part with no geometry are each stale
 *    rather than resolved to something nearby.
 * 6. A dimension measures the page distance or the true 3D distance, and says
 *    which; a stale end makes the whole dimension stale with the failing end's
 *    reason, from either side.
 * 7. Canonical order is numeric, so a part reordered in the model does not move a
 *    note, and an axis collapsed by its own scale has no direction.
 * 8. A sheet carrying a resolved note declares that it sized the note's anchor and
 *    not the lettering; a sheet whose every note is stale declares nothing,
 *    because it set no text at all.
 */
export const test_drawing_annotation_resolution = (): void => {
  const environment = drawingEnvironment();
  const feature = (
    overrides: Partial<IAutoMovieDrawingFeature>,
  ): IAutoMovieDrawingFeature => ({
    element: "north-wall",
    part: null,
    kind: "vertex",
    index: 0,
    count: null,
    ...overrides,
  });
  const resolve = (
    overrides: Partial<IAutoMovieDrawingFeature>,
    where: IAutoMovieBuiltEnvironment = environment,
  ) => resolveAutoMovieDrawingFeature(where, feature(overrides));

  // 1. Every family resolves where the fixture puts it.
  TestValidator.equals(
    "each feature family resolves to the fixture's own geometry",
    namedFacts([
      [
        "the wall has 8 welded corners and the first is its origin corner",
        () => {
          const corner = resolve({ kind: "vertex", index: 0 });
          return (
            corner.count === 8 &&
            corner.status === "resolved" &&
            vclose(corner.point!, { x: 0, y: 0, z: 0 }) &&
            corner.direction === null
          );
        },
      ],
      [
        "the last corner is the far top corner of the same box",
        () =>
          vclose(resolve({ kind: "vertex", index: 7 }).point!, {
            x: 6,
            y: 3,
            z: 0.2,
          }),
      ],
      [
        "the wall has 18 welded edges and the first runs through its thickness",
        () => {
          const edge = resolve({ kind: "edge", index: 0 });
          return (
            edge.count === 18 &&
            vclose(edge.point!, { x: 0, y: 0, z: 0.1 }) &&
            vclose(edge.direction!, { x: 0, y: 0, z: 1 })
          );
        },
      ],
      [
        "the wall has 12 triangles and a face resolves to one's centre",
        () => {
          const face = resolve({ kind: "face", index: 0 });
          return face.count === 12 && face.direction === null;
        },
      ],
      [
        "the centroid of a box is the centre of the box",
        () => {
          const centre = resolve({ kind: "centroid", index: 0 });
          return (
            centre.count === 1 &&
            vclose(centre.point!, { x: 3, y: 1.5, z: 0.1 })
          );
        },
      ],
      [
        "each local axis resolves to the element's own origin and direction",
        () =>
          (
            [
              [0, { x: 1, y: 0, z: 0 }],
              [1, { x: 0, y: 1, z: 0 }],
              [2, { x: 0, y: 0, z: 1 }],
            ] as const
          ).every(([index, direction]) => {
            const axis = resolve({ kind: "axis", index });
            return (
              axis.count === 3 &&
              vclose(axis.point!, { x: 3, y: 1.5, z: 0.1 }) &&
              vclose(axis.direction!, direction)
            );
          }),
      ],
      [
        "a named part resolves the same geometry as the whole element",
        () =>
          vclose(
            resolve({ kind: "vertex", index: 7, part: "wall-body" }).point!,
            { x: 6, y: 3, z: 0.2 },
          ),
      ],
    ]),
    {
      "the wall has 8 welded corners and the first is its origin corner": true,
      "the last corner is the far top corner of the same box": true,
      "the wall has 18 welded edges and the first runs through its thickness": true,
      "the wall has 12 triangles and a face resolves to one's centre": true,
      "the centroid of a box is the centre of the box": true,
      "each local axis resolves to the element's own origin and direction": true,
      "a named part resolves the same geometry as the whole element": true,
    },
  );

  // 2. A moved wall moves its own notes.
  const moved = movedWall(environment);
  TestValidator.predicate(
    "a moved wall carries its pinned corner with it",
    vclose(resolve({ kind: "vertex", index: 7 }, moved).point!, {
      x: 6.5,
      y: 3,
      z: 0.2,
    }),
  );

  const dimensioned = (
    where: IAutoMovieBuiltEnvironment,
    measure: "page" | "world",
  ) =>
    deriveAutoMovieDrawing({
      environment: where,
      view: drawingView({
        id: "dimensioned",
        dimensions: [
          {
            id: "wall-length",
            from: feature({ kind: "vertex", index: 0, count: 8 }),
            to: feature({ kind: "vertex", index: 4, count: 8 }),
            measure,
          },
        ],
        annotations: [
          {
            id: "wall-note",
            text: "fair-faced blockwork",
            target: feature({ kind: "centroid", index: 0, count: 1 }),
          },
        ],
      }),
    });
  const before = dimensioned(environment, "world");
  const after = dimensioned(moved, "world");
  TestValidator.equals(
    "a dimension between two corners is the wall's own 6 m length",
    [before.dimensions[0]!.status, before.dimensions[0]!.value],
    ["resolved", 6],
  );
  TestValidator.equals(
    "the note resolves onto the page at the wall's own centre",
    [before.annotations[0]!.status, before.annotations[0]!.at],
    ["resolved", { x: 3, y: -0.1 }],
  );
  TestValidator.equals(
    "a moved wall keeps its length and moves its note and its digest",
    [
      after.dimensions[0]!.value,
      after.annotations[0]!.at,
      after.digest === before.digest,
    ],
    [6, { x: 3.5, y: -0.1 }, false],
  );
  TestValidator.predicate(
    "a page dimension measures the drawing and a world dimension measures the building",
    nclose(dimensioned(environment, "page").dimensions[0]!.value!, 6) &&
      nclose(
        deriveAutoMovieDrawing({
          environment,
          view: drawingView({
            id: "sloped",
            dimensions: [
              {
                id: "diagonal",
                from: feature({ kind: "vertex", index: 0 }),
                to: feature({ kind: "vertex", index: 7 }),
                measure: "page",
              },
            ],
          }),
        }).dimensions[0]!.value!,
        Math.hypot(6, 0.2),
      ),
  );

  // 3-5. Staleness.
  TestValidator.equals(
    "every way a target can stop addressing the design is reported, not guessed",
    namedFacts([
      [
        "a target authored against another count is stale though its index fits",
        () => {
          const stale = resolve({ kind: "vertex", index: 0, count: 9 });
          return (
            stale.status === "stale" &&
            stale.count === 8 &&
            stale.point === null &&
            stale.reason ===
              'element "north-wall" now has 8 vertex features, but the target was authored against 9'
          );
        },
      ],
      [
        "an index past the end is stale and says how many there are",
        () =>
          resolve({ kind: "vertex", index: 8 }).reason ===
          'element "north-wall" vertex index 8 is outside its 8 vertex features',
      ],
      [
        "a fractional index is stale rather than truncated",
        () => resolve({ kind: "edge", index: 1.5 }).status === "stale",
      ],
      [
        "a negative index is stale",
        () => resolve({ kind: "face", index: -1 }).status === "stale",
      ],
      [
        "an axis index outside 0..2, or between them, is stale",
        () =>
          resolve({ kind: "axis", index: 3 }).reason ===
            'element "north-wall" axis index must be 0, 1 or 2, but was 3' &&
          resolve({ kind: "axis", index: -1 }).status === "stale" &&
          // A fractional axis names no axis; without an integral guard this
          // would select none of the three and be reported as a collapsed
          // scale, which is a true message about the wrong thing.
          resolve({ kind: "axis", index: 1.5 }).reason ===
            'element "north-wall" axis index must be 0, 1 or 2, but was 1.5',
      ],
      [
        "an axis count that is not three is stale and reports the three",
        () => {
          const stale = resolve({ kind: "axis", index: 0, count: 2 });
          return stale.status === "stale" && stale.count === 3;
        },
      ],
      [
        "a centroid index other than zero is stale",
        () =>
          resolve({ kind: "centroid", index: 1 }).reason ===
          'element "north-wall" centroid index must be 0, but was 1',
      ],
      [
        "a centroid count other than one is stale and reports the one",
        () => {
          const stale = resolve({ kind: "centroid", index: 0, count: 2 });
          return stale.status === "stale" && stale.count === 1;
        },
      ],
      [
        "a missing element is stale and names the environment",
        () =>
          resolve({ element: "no-such-wall" }).reason ===
          'built environment "atelier" has no element "no-such-wall"',
      ],
      [
        "an element with no model carries no vertex",
        () =>
          resolve({ element: "shell", kind: "vertex" }).reason ===
          'element "shell" has no model, so it carries no "vertex" feature',
      ],
      [
        "an element with no model still has axes, because a transform has axes",
        () =>
          resolve({ element: "shell", kind: "axis", index: 1 }).status ===
          "resolved",
      ],
      [
        "a runtime model the design does not carry is stale",
        () =>
          resolve({ element: "floor-slab" }, externalModel(environment))
            .reason ===
          'element "floor-slab" cites runtime model "slab", whose geometry this design does not carry',
      ],
      [
        "a part the model does not have is stale",
        () =>
          resolve({ part: "no-such-part" }).reason ===
          'model "wall" has no part "no-such-part"',
      ],
      [
        "a part with no drawn geometry has no centroid",
        () =>
          resolve(
            { element: "floor-slab", kind: "centroid", index: 0 },
            emptyGeometry(environment),
          ).reason ===
          'element "floor-slab" has no geometry, so it has no centroid',
      ],
      [
        "an axis a zero scale collapsed has no direction to point along",
        () =>
          resolve(
            { element: "north-wall", kind: "axis", index: 0 },
            collapsedWall(environment),
          ).reason ===
          'element "north-wall" axis 0 is collapsed by its own scale, so it has no direction',
      ],
    ]),
    {
      "a target authored against another count is stale though its index fits": true,
      "an index past the end is stale and says how many there are": true,
      "a fractional index is stale rather than truncated": true,
      "a negative index is stale": true,
      "an axis index outside 0..2, or between them, is stale": true,
      "an axis count that is not three is stale and reports the three": true,
      "a centroid index other than zero is stale": true,
      "a centroid count other than one is stale and reports the one": true,
      "a missing element is stale and names the environment": true,
      "an element with no model carries no vertex": true,
      "an element with no model still has axes, because a transform has axes": true,
      "a runtime model the design does not carry is stale": true,
      "a part the model does not have is stale": true,
      "a part with no drawn geometry has no centroid": true,
      "an axis a zero scale collapsed has no direction to point along": true,
    },
  );

  // 6. A stale end makes the dimension stale, from either side.
  const broken = deriveAutoMovieDrawing({
    environment,
    view: drawingView({
      id: "broken",
      dimensions: [
        {
          id: "left-end-gone",
          from: feature({ element: "no-such-wall" }),
          to: feature({ kind: "vertex", index: 4 }),
          measure: "world",
        },
        {
          id: "right-end-gone",
          from: feature({ kind: "vertex", index: 0 }),
          to: feature({ element: "no-such-wall" }),
          measure: "page",
        },
      ],
      annotations: [
        {
          id: "note-gone",
          text: "this one lost its wall",
          target: feature({ element: "no-such-wall", kind: "centroid" }),
        },
      ],
    }),
  });
  TestValidator.equals(
    "a stale end at either side makes the whole dimension stale with its reason",
    broken.dimensions.map((dimension) => [
      dimension.id,
      dimension.status,
      dimension.from,
      dimension.to,
      dimension.value,
      dimension.reason,
    ]),
    [
      [
        "left-end-gone",
        "stale",
        null,
        null,
        null,
        'built environment "atelier" has no element "no-such-wall"',
      ],
      [
        "right-end-gone",
        "stale",
        null,
        null,
        null,
        'built environment "atelier" has no element "no-such-wall"',
      ],
    ],
  );
  TestValidator.equals(
    "a note whose target is gone is stale rather than left at its last place",
    broken.annotations,
    [
      {
        id: "note-gone",
        text: "this one lost its wall",
        status: "stale",
        at: null,
        reason: 'built environment "atelier" has no element "no-such-wall"',
      },
    ],
  );

  // 7. Canonical order is a property of the geometry, not of the file.
  const forward = twoPartWall(environment, false);
  const reversed = twoPartWall(environment, true);
  TestValidator.equals(
    "reordering a model's parts leaves every pinned corner exactly where it was",
    [3, 7, 11, 15].map(
      (index) => resolve({ kind: "vertex", index }, reversed).point,
    ),
    [3, 7, 11, 15].map(
      (index) => resolve({ kind: "vertex", index }, forward).point,
    ),
  );
  TestValidator.equals(
    "two disjoint parts contribute their corners once each",
    resolve({ kind: "vertex", index: 0 }, reversed).count,
    16,
  );
  TestValidator.equals(
    "an edge whose two ends weld onto one corner is not an edge",
    // The sliver's first two corners round onto the same point, so the ring
    // has three corners and only two edges between them: a zero-length edge is
    // not a feature a note could be pinned to.
    [
      resolve(
        { element: "floor-slab", kind: "vertex" },
        sliverSlab(environment),
      ).count,
      resolve({ element: "floor-slab", kind: "edge" }, sliverSlab(environment))
        .count,
    ],
    [2, 1],
  );

  // 8. What the sheet sized, and what it could not.
  TestValidator.equals(
    "a sheet with a note says it sized the anchor and not the lettering",
    [
      before.gaps.find((gap) => gap.subject === "note-text-extent")?.status,
      // Every note on this one is stale, so no text was set and there is no
      // unmeasured run of glyphs to declare.
      broken.gaps.some((gap) => gap.subject === "note-text-extent"),
    ],
    ["unsupported", false],
  );
};

/** The same design with the slab replaced by one welded-corner sliver triangle. */
const sliverSlab = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: environment.models.map((model) =>
    model.id === "slab"
      ? {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: {
                type: "mesh" as const,
                mesh: {
                  positions: [0, 0, 0, 1e-7, 0, 0, 0, 0, 1],
                  normals: null,
                  uvs: null,
                  indices: [0, 1, 2],
                  skin: null,
                },
              },
            },
          ],
        }
      : model,
  ),
});

/** The same design with the wall moved half a metre along the plan. */
const movedWall = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  elements: environment.elements.map((element) =>
    element.id === "north-wall"
      ? { ...element, transform: drawingPlace(3.5, 1.5, 0.1) }
      : element,
  ),
});

/** The same design with the wall flattened along its own local X. */
const collapsedWall = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  elements: environment.elements.map((element) =>
    element.id === "north-wall"
      ? {
          ...element,
          transform: {
            ...element.transform,
            scale: { x: 0, y: 1, z: 1 },
          },
        }
      : element,
  ),
});

/** The same design with the slab's geometry owned by the compiler. */
const externalModel = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: environment.models.filter((model) => model.id !== "slab"),
  modelReferences: ["slab"],
});

/** The same design with the slab's model carrying vertices and no triangle. */
const emptyGeometry = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: environment.models.map((model) =>
    model.id === "slab"
      ? {
          ...model,
          parts: [
            {
              ...model.parts[0]!,
              geometry: {
                type: "mesh" as const,
                mesh: {
                  positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
                  normals: null,
                  uvs: null,
                  indices: [],
                  skin: null,
                },
              },
            },
          ],
        }
      : model,
  ),
});

/**
 * The wall and a pilaster beside it, as two model parts in either order.
 *
 * `reversed` writes the same two parts the other way round. Nothing about the
 * building changed, only the order the model file happens to list its parts in,
 * and a canonical feature order must not care: if it did, editing a model would
 * renumber every note on every sheet that cites it.
 */
const twoPartWall = (
  environment: IAutoMovieBuiltEnvironment,
  reversed: boolean,
): IAutoMovieBuiltEnvironment => {
  const body = environment.models.find((model) => model.id === "wall")!
    .parts[0]!;
  const parts = [
    body,
    {
      ...body,
      id: "wall-pilaster",
      geometry: {
        type: "primitive" as const,
        shape: { type: "box" as const, width: 0.4, height: 3, depth: 0.4 },
      },
      transform: drawingPlace(3.2, 0, 0),
    },
  ];
  return {
    ...environment,
    models: environment.models.map((model) =>
      model.id === "wall"
        ? { ...model, parts: reversed ? [...parts].reverse() : parts }
        : model,
    ),
  };
};
