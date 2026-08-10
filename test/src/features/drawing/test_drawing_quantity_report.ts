import {
  AUTOMOVIE_QUANTITY_CELL_UNION_APPROXIMATION,
  AUTOMOVIE_QUANTITY_MAX_CONTRIBUTORS,
  AUTOMOVIE_QUANTITY_SUBJECTS,
  autoMovieDrawingCellSection,
  autoMovieDrawingCellVolume,
  autoMovieDrawingFrame,
  autoMovieDrawingPolygonArea,
  deriveAutoMovieDrawing,
  measureAutoMovieQuantities,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieHalfSpacePlane,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  drawingCell,
  drawingEnvironment,
  drawingView,
} from "../internal/drawingFixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

/**
 * The design is measured, and every number says whether it can be believed.
 *
 * All of it is hand arithmetic over the fixture. The hall is 10 x 6 on plan, so
 * its floor is 60 m2 and its 3 m volume is 180 m3; the roof deck adds 10 x 0.5
 * x 6 = 30 m3; the stair route climbs 3 and runs 2 in one leg, so it is the
 * square root of 13 long; the ramp climbs 3 and runs 4, so it is exactly 5. The
 * door void is 0.9 x 2.1 = 1.89 m2 and the oculus is a circle of radius 0.3.
 *
 * The volume figure is the one that must not be read as exact. A logical space
 * is a union of convex cells and this is the sum of them, so the report says
 * `approximate` and says precisely why — the limit recorded as issue #1868, not
 * a hedge.
 *
 * Scenarios:
 *
 * 1. Every subject is answered for, in the fixed order, at the fixture's own
 *    dimensions and units.
 * 2. Areas, lengths and counts are `exact`; a logical volume is `approximate` and
 *    names the union-of-cells limit as its reason.
 * 3. Contributors are bounded: what the bound leaves out is counted and summed,
 *    and the total still covers every owner.
 * 4. A subject with nothing to measure reports a zero over zero owners rather than
 *    vanishing from the report.
 * 5. Openings with no void, and cells no volume can be computed for, are gaps
 *    rather than omissions or zeros.
 * 6. A convex cell's volume is its own arithmetic: a box, a box with a corner cut
 *    off, a cell written with unnormalized normals, and a cell nothing bounds.
 * 7. A cell's cross-section is exact where the cut passes through it, empty where
 *    it does not, and reported as unbounded where the design never closed it.
 * 8. A malformed bound and an invalid design are refused at their own messages.
 */
export const test_drawing_quantity_report = (): void => {
  const environment = drawingEnvironment();
  const report = measureAutoMovieQuantities({ environment });
  const finding = (subject: string) =>
    report.findings.find((entry) => entry.subject === subject)!;

  // 1-2. Every subject, at the fixture's own dimensions.
  TestValidator.equals(
    "the report answers for every subject, in the fixed order",
    [
      report.version,
      report.protocol,
      report.environment,
      report.findings.map((entry) => entry.subject),
    ],
    [1, "automovie.quantity.v1", "atelier", AUTOMOVIE_QUANTITY_SUBJECTS],
  );
  TestValidator.equals(
    "areas, lengths and counts are the fixture's own arithmetic",
    report.findings.map((entry) => [
      entry.subject,
      entry.unit,
      entry.total,
      entry.owners,
      entry.basis,
    ]),
    [
      ["space-floor-area", "m2", 60, 1, "exact"],
      ["space-volume", "m3", 210, 2, "approximate"],
      // 0.9 x 2.1 plus a circle of radius 0.3.
      ["opening-area", "m2", 2.172743, 2, "exact"],
      // The square root of 13, plus a 3-4-5 ramp.
      ["connector-length", "m", 8.605551, 2, "exact"],
      ["element-count", "count", 6, 6, "exact"],
      ["opening-count", "count", 3, 3, "exact"],
      ["model-occurrence-count", "count", 5, 4, "exact"],
    ],
  );
  TestValidator.equals(
    "a logical volume names the union-of-cells limit as its own approximation",
    [
      finding("space-volume").approximation,
      finding("space-floor-area").approximation,
      finding("space-volume").contributors,
    ],
    [
      AUTOMOVIE_QUANTITY_CELL_UNION_APPROXIMATION,
      null,
      [
        { owner: "hall", value: 180 },
        { owner: "roof-deck", value: 30 },
      ],
    ],
  );
  TestValidator.equals(
    "owners are ordered by what they cost, then by their own id",
    [
      finding("connector-length").contributors,
      finding("model-occurrence-count").contributors,
    ],
    [
      [
        { owner: "service-ramp", value: 5 },
        { owner: "roof-stair", value: 3.605551 },
      ],
      [
        { owner: "slab", value: 2 },
        { owner: "beam", value: 1 },
        { owner: "leaf", value: 1 },
        { owner: "wall", value: 1 },
      ],
    ],
  );
  TestValidator.predicate(
    "the door and the oculus are measured from their own voids",
    nclose(
      finding("opening-area").contributors.find(
        (entry) => entry.owner === "oculus",
      )!.value,
      Math.PI * 0.09,
    ) &&
      finding("opening-area").contributors.find(
        (entry) => entry.owner === "front-door",
      )!.value === 1.89,
  );

  // 3. The bound.
  const bounded = measureAutoMovieQuantities({
    environment,
    maxContributors: 2,
  }).findings.find((entry) => entry.subject === "element-count")!;
  TestValidator.equals(
    "the bound names two owners, counts the other four, and still totals six",
    [
      bounded.total,
      bounded.owners,
      bounded.contributors.map((entry) => entry.owner),
      bounded.omittedOwners,
      bounded.omittedValue,
      AUTOMOVIE_QUANTITY_MAX_CONTRIBUTORS,
    ],
    [6, 6, ["beam", "building"], 4, 4, 8],
  );
  TestValidator.equals(
    "the default bound leaves nothing out of a building this small",
    report.findings.map((entry) => [entry.omittedOwners, entry.omittedValue]),
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  );
  TestValidator.equals(
    "the same design measures the same bytes twice",
    measureAutoMovieQuantities({ environment: drawingEnvironment() }).digest,
    report.digest,
  );

  // 4. A subject with nothing to measure.
  const bare = measureAutoMovieQuantities({
    environment: withoutOpenings(environment),
  });
  TestValidator.equals(
    "a design with no openings reports a zero over zero owners, not a hole",
    bare.findings
      .filter((entry) => entry.subject.startsWith("opening-"))
      .map((entry) => [
        entry.subject,
        entry.total,
        entry.owners,
        entry.contributors.length,
      ]),
    [
      ["opening-area", 0, 0, 0],
      ["opening-count", 0, 0, 0],
    ],
  );

  // 5. Gaps.
  TestValidator.equals(
    "the report names every take-off the design cannot support",
    report.gaps.map((gap) => [gap.subject, gap.status]),
    [
      ["developed-surface-area", "unsupported"],
      ["material-quantity", "unsupported"],
      ["opening-area", "not-run"],
      ["opening-deduction", "unsupported"],
      ["pattern-cut-waste", "unsupported"],
      ["surface-identity", "unsupported"],
    ],
  );
  TestValidator.equals(
    "a design whose every opening carries a void reports no opening gap",
    bare.gaps.some((gap) => gap.subject === "opening-area"),
    false,
  );
  const unbounded = measureAutoMovieQuantities({
    environment: unboundedCell(environment),
  });
  TestValidator.equals(
    "a cell nothing bounds contributes nothing and is reported as not run",
    [
      unbounded.findings.find((entry) => entry.subject === "space-volume")!
        .total,
      unbounded.gaps.find((gap) => gap.subject === "unbounded-space-cell")
        ?.status,
    ],
    // The hall's 180 and the deck's 30 still measure; the open cell adds
    // nothing rather than adding a horizon.
    [210, "not-run"],
  );

  // 6. Cell volume.
  const box = (
    min: [number, number, number],
    max: [number, number, number],
  ): IAutoMovieHalfSpacePlane[] =>
    drawingCell(
      "probe",
      { x: min[0], y: min[1], z: min[2] },
      { x: max[0], y: max[1], z: max[2] },
    ).planes;
  TestValidator.equals(
    "a convex cell's volume is the volume of the solid it bounds",
    namedFacts([
      [
        "a 2 by 3 by 4 box is 24 cubic metres",
        () =>
          nclose(autoMovieDrawingCellVolume(box([0, 0, 0], [2, 3, 4]))!, 24),
      ],
      [
        "the same box written with unnormalized normals is the same volume",
        () =>
          nclose(
            autoMovieDrawingCellVolume(
              box([0, 0, 0], [2, 3, 4]).map((plane) => ({
                normal: {
                  x: plane.normal.x * 5,
                  y: plane.normal.y * 5,
                  z: plane.normal.z * 5,
                },
                offset: plane.offset * 5,
              })),
            )!,
            24,
          ),
      ],
      [
        "a repeated face is redundant, not a second face",
        () =>
          nclose(
            autoMovieDrawingCellVolume([
              ...box([0, 0, 0], [2, 3, 4]),
              { normal: { x: 1, y: 0, z: 0 }, offset: 2 },
            ])!,
            24,
          ),
      ],
      [
        "a plane touching only one edge bounds no face and adds no cone",
        () =>
          nclose(
            autoMovieDrawingCellVolume([
              ...box([0, 0, 0], [2, 2, 2]),
              // Through the whole x = 2, y = 2 edge and nothing else.
              { normal: { x: 1, y: 1, z: 0 }, offset: 4 },
            ])!,
            8,
          ),
      ],
      [
        "a corner cut off a unit cube removes exactly a sixth of it",
        () =>
          nclose(
            autoMovieDrawingCellVolume([
              ...box([0, 0, 0], [1, 1, 1]),
              // x + y + z <= 2 slices the corner at (1, 1, 1); the piece it
              // removes is a tetrahedron of legs 1, so 1/6 of a cubic metre.
              { normal: { x: 1, y: 1, z: 1 }, offset: 2 },
            ])!,
            1 - 1 / 6,
          ),
      ],
      [
        "a column open at one end reports no volume rather than a confident zero",
        () =>
          autoMovieDrawingCellVolume([
            { normal: { x: 1, y: 0, z: 0 }, offset: 1 },
            { normal: { x: -1, y: 0, z: 0 }, offset: 0 },
            { normal: { x: 0, y: 0, z: 1 }, offset: 1 },
            { normal: { x: 0, y: 0, z: -1 }, offset: 0 },
            // Bounded on four sides and open upward: four corners exist, so a
            // vertex count alone would let it through.
            { normal: { x: 0, y: -1, z: 0 }, offset: 0 },
          ]) === null,
      ],
      [
        "a wedge capped twice and open below reports no volume either",
        () =>
          autoMovieDrawingCellVolume([
            { normal: { x: 1, y: 0, z: 0 }, offset: 1 },
            { normal: { x: -1, y: 0, z: 0 }, offset: 1 },
            { normal: { x: 0, y: 0, z: 1 }, offset: 1 },
            { normal: { x: 0, y: 0, z: -1 }, offset: 0 },
            // Two capping planes meeting in a ridge give six non-coplanar
            // corners, and the solid still runs off downward.
            { normal: { x: -1, y: 1, z: 0 }, offset: 5 },
            { normal: { x: 1, y: 1, z: 0 }, offset: 5 },
          ]) === null,
      ],
      [
        "four parallel planes bound no solid and report none",
        () =>
          autoMovieDrawingCellVolume([
            { normal: { x: 1, y: 0, z: 0 }, offset: 1 },
            { normal: { x: 1, y: 0, z: 0 }, offset: 2 },
            { normal: { x: 1, y: 0, z: 0 }, offset: 3 },
            { normal: { x: 1, y: 0, z: 0 }, offset: 4 },
          ]) === null,
      ],
      [
        "a polygon of fewer than three points encloses nothing",
        () =>
          autoMovieDrawingPolygonArea([
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]) === 0,
      ],
    ]),
    {
      "a 2 by 3 by 4 box is 24 cubic metres": true,
      "the same box written with unnormalized normals is the same volume": true,
      "a repeated face is redundant, not a second face": true,
      "a plane touching only one edge bounds no face and adds no cone": true,
      "a corner cut off a unit cube removes exactly a sixth of it": true,
      "a column open at one end reports no volume rather than a confident zero": true,
      "a wedge capped twice and open below reports no volume either": true,
      "four parallel planes bound no solid and report none": true,
      "a polygon of fewer than three points encloses nothing": true,
    },
  );

  // 7. Cross-sections.
  const frame = autoMovieDrawingFrame(drawingView());
  TestValidator.equals(
    "a cross-section is the cell where the cut meets it and nothing where it does not",
    namedFacts([
      [
        "a box the cut passes through sections at its own plan extent",
        () => {
          const section = autoMovieDrawingCellSection(
            frame,
            box([0, 0, 0], [2, 3, 4]),
          );
          return (
            section.bounded === true &&
            nclose(autoMovieDrawingPolygonArea(section.polygon), 8)
          );
        },
      ],
      [
        "a box wholly above the cut sections to nothing",
        () =>
          autoMovieDrawingCellSection(frame, box([0, 2, 0], [2, 3, 4])).polygon
            .length === 0,
      ],
      [
        "a cell whose own half-spaces contradict sections to nothing",
        () =>
          autoMovieDrawingCellSection(frame, [
            { normal: { x: 1, y: 0, z: 0 }, offset: 1 },
            { normal: { x: -1, y: 0, z: 0 }, offset: -5 },
            { normal: { x: 0, y: 1, z: 0 }, offset: 3 },
            { normal: { x: 0, y: -1, z: 0 }, offset: 0 },
          ]).polygon.length === 0,
      ],
      [
        "a cell the design never closed is reported unbounded rather than drawn",
        () =>
          autoMovieDrawingCellSection(frame, [
            { normal: { x: 1, y: 0, z: 0 }, offset: 10 },
            { normal: { x: -1, y: 0, z: 0 }, offset: 0 },
            { normal: { x: 0, y: 1, z: 0 }, offset: 3 },
            { normal: { x: 0, y: -1, z: 0 }, offset: 0 },
          ]).bounded === false,
      ],
      [
        "the plan of an unbounded cell says so instead of drawing a horizon",
        () => {
          const drawing = deriveAutoMovieDrawing({
            environment: unboundedCell(environment),
            view: drawingView({ id: "unbounded" }),
          });
          return (
            // The same word the quantity report uses: the section exists and
            // the closed cell it needs does not.
            drawing.gaps.find((gap) => gap.subject === "unbounded-space-cell")
              ?.status === "not-run" &&
            drawing.regions.every((region) => region.cell !== "open-cell")
          );
        },
      ],
    ]),
    {
      "a box the cut passes through sections at its own plan extent": true,
      "a box wholly above the cut sections to nothing": true,
      "a cell whose own half-spaces contradict sections to nothing": true,
      "a cell the design never closed is reported unbounded rather than drawn": true,
      "the plan of an unbounded cell says so instead of drawing a horizon": true,
    },
  );

  // 8. Refusals.
  TestValidator.equals(
    "a malformed bound and an invalid design are refused at their own messages",
    namedFacts([
      [
        "a fractional contributor bound is refused",
        () =>
          throwsError(
            () =>
              measureAutoMovieQuantities({ environment, maxContributors: 1.5 }),
            "must be a positive safe integer",
          ),
      ],
      [
        "a zero contributor bound is refused",
        () =>
          throwsError(
            () =>
              measureAutoMovieQuantities({ environment, maxContributors: 0 }),
            "must be a positive safe integer",
          ),
      ],
      [
        "a bound of one is accepted and names exactly one owner",
        () =>
          measureAutoMovieQuantities({
            environment,
            maxContributors: 1,
          }).findings.find((entry) => entry.subject === "element-count")!
            .contributors.length === 1,
      ],
      [
        "an invalid design is refused before anything is measured",
        () =>
          throwsError(
            () =>
              measureAutoMovieQuantities({
                environment: { ...environment, version: 2 as unknown as 1 },
              }),
            ["is invalid at", "building schema version must be 1"],
          ),
      ],
    ]),
    {
      "a fractional contributor bound is refused": true,
      "a zero contributor bound is refused": true,
      "a bound of one is accepted and names exactly one owner": true,
      "an invalid design is refused before anything is measured": true,
    },
  );
};

/** The same design with every opening removed. */
const withoutOpenings = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({ ...environment, openings: [] });

/**
 * The same design with an extra logical space nothing closes.
 *
 * Four half-spaces bound its x and y and leave z running to the horizon, which
 * is a real authoring mistake and the one case a cross-section and a volume
 * both have to decline rather than answer.
 */
const unboundedCell = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  spaces: [
    ...environment.spaces,
    {
      id: "open-air",
      kind: "void",
      parent: "site",
      cells: [
        {
          id: "open-cell",
          planes: [
            { normal: { x: 1, y: 0, z: 0 }, offset: 10 },
            { normal: { x: -1, y: 0, z: 0 }, offset: 0 },
            { normal: { x: 0, y: 1, z: 0 }, offset: 3 },
            { normal: { x: 0, y: -1, z: 0 }, offset: 0 },
          ],
        },
      ],
    },
  ],
});
