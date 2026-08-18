import {
  AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS,
  autoMovieBoundaryFacePoint,
  autoMovieBoundaryShellTriangles,
  autoMovieOpeningArea,
  autoMovieOpeningExtent,
  autoMovieOpeningFillExtent,
  autoMovieOpeningHasArc,
  autoMovieOpeningOutlinePoints,
  deriveAutoMovieDrawing,
  deriveAutoMovieDrawingSchedule,
  triangulateAutoMoviePolygon,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMoviePlanarPoint,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { drawingEnvironment, drawingView } from "../internal/drawingFixtures";
import {
  namedFacts,
  nclose,
  throwsError,
  vclose,
} from "../internal/predicates";

/**
 * A door schedule is the plan counted, so the two cannot disagree about how
 * many doors the building has.
 *
 * Every size below is hand arithmetic over the fixture's own voids: the front
 * door's outline is 0.9 x 2.1 and its area is 1.89 m2; the oculus is two
 * half-turn arcs of chord 0.6, so it is a circle of radius 0.3 whose extent is
 * 0.6 either way and whose area is 0.09 pi. The oculus is also the case that
 * distinguishes a measurement from a drawing: its drafted outline is chords,
 * and its scheduled area is the closed-form circle.
 *
 * Scenarios:
 *
 * 1. The schedule's total is the design's own opening count, and the row counts
 *    sum to it; the same openings appear on the plan by the same ids.
 * 2. A void authored on a boundary face is scheduled as `profile`; a filling
 *    element standing in for one is `fill` and is labelled as the leaf it is;
 *    neither present is `unmeasured` with `null` sizes and a declared gap.
 * 3. Type marks are assigned from the canonical order, per kind, and are stable
 *    across runs of the same design.
 * 4. A type with more occurrences than the bound names the bound's worth and
 *    counts the rest.
 * 5. Connectors are scheduled by the section that governs them: the stated
 *    constant pair, or the narrowest and lowest sampled section.
 * 6. An opening's exact area and its drafted chord outline are different
 *    computations, and the drawing says the arcs are chorded.
 * 7. A boundary face becomes a closed solid whether its outline was authored
 *    clockwise or counter-clockwise, and a concave outline is ear-clipped
 *    rather than fanned.
 * 8. An invalid design is refused before anything is scheduled.
 */
export const test_drawing_opening_schedule = (): void => {
  const environment = drawingEnvironment();
  const schedule = deriveAutoMovieDrawingSchedule({
    environment,
    subject: "opening",
  });

  // 1. The schedule and the model count the same things.
  TestValidator.equals(
    "the schedule totals the design's own openings and its rows sum to that",
    [
      schedule.version,
      schedule.protocol,
      schedule.environment,
      schedule.subject,
      schedule.total,
      schedule.rows.reduce((sum, row) => sum + row.count, 0),
      environment.openings.length,
    ],
    [1, "automovie.drawing-schedule.v1", "atelier", "opening", 3, 3, 3],
  );
  TestValidator.equals(
    "the plan marks exactly the openings the schedule lists",
    deriveAutoMovieDrawing({ environment, view: drawingView() })
      .openings.map((mark) => mark.opening)
      .sort(byText),
    schedule.rows.flatMap((row) => row.members).sort(byText),
  );

  // 2-3. Basis, sizes and marks.
  TestValidator.equals(
    "each type is scheduled at the size the design proves, and says which",
    schedule.rows,
    [
      {
        mark: "door-01",
        kind: "door",
        model: "leaf",
        width: 0.9,
        height: 2.1,
        count: 1,
        members: ["front-door"],
        omittedMembers: 0,
        basis: "profile",
        place: {
          kind: "opening",
          building: "unit-a",
          boundary: "north",
          separates: ["hall"],
        },
      },
      {
        mark: "vent-01",
        kind: "vent",
        model: null,
        width: null,
        height: null,
        count: 1,
        members: ["vent"],
        omittedMembers: 0,
        basis: "unmeasured",
        place: {
          kind: "opening",
          building: "unit-a",
          boundary: "north",
          separates: ["hall"],
        },
      },
      {
        mark: "window-01",
        kind: "window",
        model: null,
        width: 0.6,
        height: 0.6,
        count: 1,
        members: ["oculus"],
        omittedMembers: 0,
        basis: "profile",
        place: {
          kind: "opening",
          building: "unit-a",
          boundary: "north",
          separates: ["hall"],
        },
      },
    ],
  );
  TestValidator.equals(
    "an opening with no void is scheduled from its leaf, and labelled as the leaf",
    deriveAutoMovieDrawingSchedule({
      environment: withoutDoorProfile(environment),
      subject: "opening",
    }).rows.find((row) => row.kind === "door"),
    {
      mark: "door-01",
      kind: "door",
      model: "leaf",
      // The leaf is 0.9 x 2.1 x 0.05, so its widest horizontal extent is its
      // own 0.9 and its height is its own 2.1 — the leaf, not the hole.
      width: 0.9,
      height: 2.1,
      count: 1,
      members: ["front-door"],
      omittedMembers: 0,
      basis: "fill",
      place: {
        kind: "opening",
        building: "unit-a",
        boundary: "north",
        separates: ["hall"],
      },
    },
  );
  TestValidator.equals(
    "the schedule declares what it could not measure and what it never models",
    schedule.gaps.map((gap) => [gap.subject, gap.status]),
    [
      ["opening-geometry", "not-run"],
      // `opening-location` used to sit here, saying the place had to be read
      // from the design. The row reads it from the design now, so the gap is
      // gone rather than relabelled.
      ["opening-performance", "unsupported"],
    ],
  );
  TestValidator.equals(
    "a leaf whose model the design does not carry leaves its type unmeasured",
    deriveAutoMovieDrawingSchedule({
      environment: withoutDoorProfile(externalLeaf(environment)),
      subject: "opening",
    }).rows.find((row) => row.kind === "door"),
    {
      mark: "door-01",
      kind: "door",
      model: "leaf",
      width: null,
      height: null,
      count: 1,
      members: ["front-door"],
      omittedMembers: 0,
      basis: "unmeasured",
      place: {
        kind: "opening",
        building: "unit-a",
        boundary: "north",
        separates: ["hall"],
      },
    },
  );
  TestValidator.equals(
    "a leaf that draws nothing leaves its type unmeasured rather than zero-sized",
    deriveAutoMovieDrawingSchedule({
      environment: withoutDoorProfile(emptyLeaf(environment)),
      subject: "opening",
    }).rows.find((row) => row.kind === "door")?.basis,
    "unmeasured",
  );

  // 4. The bound.
  const many = manyPorts(environment, 11);
  const bounded = deriveAutoMovieDrawingSchedule({
    environment: many,
    subject: "opening",
  }).rows.find((row) => row.kind === "port")!;
  TestValidator.equals(
    "a type with more occurrences than the bound names some and counts the rest",
    [
      bounded.count,
      bounded.members.length,
      bounded.omittedMembers,
      bounded.members[0],
      AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS,
    ],
    [11, 8, 3, "port-00", 8],
  );
  const varied = deriveAutoMovieDrawingSchedule({
    environment: moreOpeningTypes(environment),
    subject: "opening",
  });
  TestValidator.equals(
    "types of one kind are marked in the canonical order the schedule declares",
    varied.rows
      .filter((row) => row.kind === "door")
      .map((row) => [row.mark, row.model, row.width, row.height, row.basis]),
    // Ordered by model, then width, then height, then basis: the leaf-backed
    // pair first because "leaf" precedes an absent model, the measured pair
    // split by where each size came from, then the model-less voids by size.
    [
      ["door-01", "leaf", 0.9, 2.1, "fill"],
      ["door-02", "leaf", 0.9, 2.1, "profile"],
      ["door-03", null, 0.8, 2.1, "profile"],
      ["door-04", null, 1, 2.1, "profile"],
      ["door-05", null, 1, 2.4, "profile"],
    ],
  );
  TestValidator.equals(
    "an unmeasured type is ordered before a measured one of the same kind",
    varied.rows
      .filter((row) => row.kind === "vent")
      .map((row) => [row.mark, row.width, row.basis]),
    [
      ["vent-01", null, "unmeasured"],
      ["vent-02", 0.5, "profile"],
    ],
  );
  TestValidator.equals(
    "the total still counts every opening the design declares",
    [varied.total, varied.rows.reduce((sum, row) => sum + row.count, 0)],
    [8, 8],
  );
  const reversed = moreOpeningTypes(environment);
  TestValidator.equals(
    "the order the design authored its openings in does not reach the schedule",
    deriveAutoMovieDrawingSchedule({
      environment: { ...reversed, openings: [...reversed.openings].reverse() },
      subject: "opening",
    }).digest,
    varied.digest,
  );
  TestValidator.equals(
    "the same design schedules the same bytes twice",
    deriveAutoMovieDrawingSchedule({
      environment: drawingEnvironment(),
      subject: "opening",
    }).digest,
    schedule.digest,
  );

  // 5. Connectors.
  const connectors = deriveAutoMovieDrawingSchedule({
    environment,
    subject: "connector",
  });
  TestValidator.equals(
    "a connector is scheduled at the section that governs it",
    [connectors.total, connectors.rows],
    [
      2,
      [
        {
          mark: "ramp-01",
          kind: "ramp",
          model: null,
          // Sampled 1.5 and 1.2 wide, 2.2 and 2.4 clear: the narrowest and the
          // lowest are what the ramp is actually limited by.
          width: 1.2,
          height: 2.2,
          count: 1,
          members: ["service-ramp"],
          omittedMembers: 0,
          basis: "profile",
          place: {
            kind: "connector",
            building: "unit-a",
            stops: ["hall", "roof-deck"],
          },
        },
        {
          mark: "stair-01",
          kind: "stair",
          model: null,
          width: 1.2,
          height: 2.1,
          count: 1,
          members: ["roof-stair"],
          omittedMembers: 0,
          basis: "profile",
          place: {
            kind: "connector",
            building: "unit-a",
            stops: ["hall", "roof-deck"],
          },
        },
      ],
    ],
  );
  TestValidator.equals(
    "a connector schedule refuses to read a scheduled stair as a climbable one",
    connectors.gaps.map((gap) => [gap.subject, gap.status]),
    [
      // `connector-location` used to sit here. A connector row now states the
      // regions its declared stops stand in, so there is no gap to declare.
      ["traversal-performance", "unsupported"],
    ],
  );

  // 6-7. Void and face geometry.
  const door = environment.openings[0]!.profile!;
  const oculus = environment.openings[1]!.profile!;
  TestValidator.equals(
    "a void is measured from its arcs and drafted from its chords",
    namedFacts([
      [
        "a rectangular void is 0.9 by 2.1 and 1.89 square metres",
        () =>
          autoMovieOpeningExtent(door).width === 0.9 &&
          autoMovieOpeningExtent(door).height === 2.1 &&
          autoMovieOpeningArea(door) === 1.89,
      ],
      [
        "a circular void of radius 0.3 is 0.6 across and pi times 0.09 in area",
        () =>
          autoMovieOpeningExtent(oculus).width === 0.6 &&
          nclose(autoMovieOpeningArea(oculus), Math.PI * 0.09),
      ],
      [
        "a rectangle is drafted through its own four corners and no more",
        () => autoMovieOpeningOutlinePoints(door).length === 4,
      ],
      [
        "a half-turn arc is drafted as sixteen chords at the fixed density",
        () => autoMovieOpeningOutlinePoints(oculus).length === 32,
      ],
      [
        "the first arc leans to the left of its own edge, as the hull does",
        () =>
          autoMovieOpeningOutlinePoints(oculus)
            .slice(1, 16)
            .every((point: IAutoMoviePlanarPoint) => point.y > 2),
      ],
      [
        "an arc too shallow to need a chord is drafted as its own endpoints",
        () =>
          autoMovieOpeningOutlinePoints({
            outline: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
            ],
            bulges: [0.02, 0, 0],
          }).length === 3,
      ],
      [
        "a zero-length edge carries no arc at all",
        () =>
          autoMovieOpeningOutlinePoints({
            outline: [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
            bulges: [1, 0, 0],
          }).length === 3,
      ],
      [
        "a profile that states no bulge and one that states only zeros are straight",
        () =>
          autoMovieOpeningHasArc(door) === false &&
          autoMovieOpeningHasArc({ ...door, bulges: [0, 0, 0, 0] }) === false &&
          autoMovieOpeningHasArc(oculus) === true,
      ],
      [
        "a bulge to the right encloses less than the chord's own polygon",
        () =>
          autoMovieOpeningArea({
            outline: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 },
            ],
            bulges: [0.5, 0, 0, 0],
          }) < 1,
      ],
      [
        "a leaf lying on its side is described as the wide, thin thing it is",
        () =>
          autoMovieOpeningFillExtent([
            { x: 0, y: 0, z: 0 },
            { x: 2, y: 0.1, z: 0.5 },
          ]).width === 2 &&
          autoMovieOpeningFillExtent([
            { x: 0, y: 0, z: 0 },
            { x: 2, y: 0.1, z: 0.5 },
          ]).height === 0.1,
      ],
    ]),
    {
      "a rectangular void is 0.9 by 2.1 and 1.89 square metres": true,
      "a circular void of radius 0.3 is 0.6 across and pi times 0.09 in area": true,
      "a rectangle is drafted through its own four corners and no more": true,
      "a half-turn arc is drafted as sixteen chords at the fixed density": true,
      "the first arc leans to the left of its own edge, as the hull does": true,
      "an arc too shallow to need a chord is drafted as its own endpoints": true,
      "a zero-length edge carries no arc at all": true,
      "a profile that states no bulge and one that states only zeros are straight": true,
      "a bulge to the right encloses less than the chord's own polygon": true,
      "a leaf lying on its side is described as the wide, thin thing it is": true,
    },
  );
  TestValidator.equals(
    "a drawing with an arced void says its linework is chorded",
    deriveAutoMovieDrawing({ environment, view: drawingView() }).gaps.find(
      (gap) => gap.subject === "curved-linework",
    )?.status,
    "unsupported",
  );

  const square = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
  ];
  TestValidator.equals(
    "a face becomes a closed solid however its outline was wound",
    namedFacts([
      [
        "a counter-clockwise face and its clockwise twin build the same solid",
        () => {
          const forward = autoMovieBoundaryShellTriangles({
            origin: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            outline: square,
            thickness: 0.5,
          });
          const reversed = autoMovieBoundaryShellTriangles({
            origin: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            outline: [...square].reverse(),
            thickness: 0.5,
          });
          // Four side quads of two triangles, plus two caps of two each.
          return forward.length === 12 && reversed.length === 12;
        },
      ],
      [
        "a face point walks the frame's own outward normal by the depth asked for",
        () =>
          vclose(
            autoMovieBoundaryFacePoint(
              {
                origin: { x: 1, y: 2, z: 3 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                outline: square,
                thickness: 0.5,
              },
              { x: 0.25, y: 0.5 },
            ),
            { x: 1.25, y: 2.5, z: 3 },
          ) &&
          vclose(
            autoMovieBoundaryFacePoint(
              {
                origin: { x: 1, y: 2, z: 3 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                outline: square,
                thickness: 0.5,
              },
              { x: 0.25, y: 0.5 },
              0.5,
            ),
            { x: 1.25, y: 2.5, z: 3.5 },
          ),
      ],
      [
        "a triangle is already a triangulation",
        () =>
          triangulateAutoMoviePolygon([
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ]).length === 1,
      ],
      [
        "a square is two triangles",
        () => triangulateAutoMoviePolygon(square).length === 2,
      ],
      [
        "fewer than three corners is refused, not returned as an empty face",
        () =>
          throwsError(
            () => triangulateAutoMoviePolygon(square.slice(0, 2)),
            "a polygon needs at least 3 corners to triangulate, but had 2",
          ),
      ],
      [
        "a concave outline is ear-clipped into four triangles inside itself",
        () => {
          const ell = [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 3 },
            { x: 0, y: 3 },
          ];
          const triangles: Array<[number, number, number]> =
            triangulateAutoMoviePolygon(ell);
          // Any simple polygon of n corners triangulates into n - 2 triangles,
          // and the total area must be the L's own 5 square metres rather than
          // the 9 a fan from one corner would sweep.
          const area = triangles.reduce(
            (sum: number, [first, second, third]) => {
              const a = ell[first]!;
              const b = ell[second]!;
              const c = ell[third]!;
              return (
                sum +
                Math.abs(
                  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
                ) /
                  2
              );
            },
            0,
          );
          return triangles.length === 4 && nclose(area, 5);
        },
      ],
    ]),
    {
      "a counter-clockwise face and its clockwise twin build the same solid": true,
      "a face point walks the frame's own outward normal by the depth asked for": true,
      "a triangle is already a triangulation": true,
      "a square is two triangles": true,
      "fewer than three corners is refused, not returned as an empty face": true,
      "a concave outline is ear-clipped into four triangles inside itself": true,
    },
  );

  // 8. Refusal.
  TestValidator.predicate(
    "an invalid design is refused before anything is scheduled",
    throwsError(
      () =>
        deriveAutoMovieDrawingSchedule({
          environment: { ...environment, units: "foot" as unknown as "meter" },
          subject: "opening",
        }),
      ["is invalid at", 'building units must be "meter"'],
    ),
  );
};

const byText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** The same design with the front door's own void removed. */
const withoutDoorProfile = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  openings: environment.openings.map((opening) =>
    opening.id === "front-door"
      ? {
          id: opening.id,
          kind: opening.kind,
          boundary: opening.boundary,
          fill: opening.fill,
        }
      : opening,
  ),
});

/** The same design with the leaf's geometry owned by the compiler. */
const externalLeaf = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: environment.models.filter((model) => model.id !== "leaf"),
  modelReferences: ["leaf"],
});

/** The same design with the leaf carrying vertices and no triangle. */
const emptyLeaf = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: environment.models.map((model) =>
    model.id === "leaf"
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

/** The same design plus `count` identical openings of one new kind. */
const manyPorts = (
  environment: IAutoMovieBuiltEnvironment,
  count: number,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  openings: [
    ...environment.openings,
    ...Array.from({ length: count }, (_, index) => ({
      id: `port-${String(index).padStart(2, "0")}`,
      kind: "port",
      boundary: "north",
      fill: null,
    })),
  ],
});

/**
 * The same design with five more openings, chosen to separate each ordering
 * tier from the next.
 *
 * A twin of the front door measured from the same leaf but with no void of its
 * own; three model-less voids that differ only in width and then only in
 * height; and a lit vent beside the unmeasured one. Every void is placed clear
 * of every other on the same 6 x 3 face, because two voids that touch are one
 * void authored twice.
 */
const moreOpeningTypes = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  openings: [
    ...environment.openings,
    { id: "twin-door", kind: "door", boundary: "north", fill: "door-leaf" },
    void_("side-door", "door", 5.2, 0, 0.8, 2.1),
    void_("wide-door", "door", 0, 0, 1, 2.1),
    void_("tall-door", "door", 4, 0, 1, 2.4),
    void_("vent-lit", "vent", 2.2, 2.4, 0.5, 0.5),
  ],
});

/** One rectangular void on the north face, placed by its own lower-left corner. */
const void_ = (
  id: string,
  kind: string,
  x: number,
  y: number,
  width: number,
  height: number,
) => ({
  id,
  kind,
  boundary: "north",
  fill: null,
  profile: {
    outline: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  },
});
