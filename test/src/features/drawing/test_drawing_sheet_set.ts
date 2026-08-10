import {
  autoMovieDrawingToSvg,
  deriveAutoMovieDrawing,
  deriveAutoMovieDrawingSchedule,
  measureAutoMovieQuantities,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawing,
  IAutoMovieDrawingView,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  drawingEnvironment,
  drawingPlace,
  drawingView,
} from "../internal/drawingFixtures";
import { namedFacts, nclose } from "../internal/predicates";

/**
 * One design, one revision, and every sheet and every count the building needs.
 *
 * The other drawing cases each prove one derivation against hand arithmetic.
 * This one proves the thing they cannot prove separately: that a floor plan, a
 * reflected ceiling plan, a finish plan, an elevation, a section, a services
 * plan, a door schedule and a take-off are eight readings of one graph rather
 * than eight documents somebody keeps in step. A drawing set maintained beside
 * a model is wrong the first time either is edited, so the property under test
 * is that editing the model is the only way to edit any of them.
 *
 * The numbers are the fixture's own. The hall is 10 x 6 on plan, so its
 * cross-section is 60 m2; the door void is 0.9 x 2.1 = 1.89 m2 and the oculus
 * is a circle of radius 0.3, so the design's openings remove 1.89 + 0.09 pi
 * square metres from their host; the side door added below is 1 x 2.1, so it
 * adds exactly 2.1 more.
 *
 * Scenarios:
 *
 * 1. Six views of one environment answer for that environment and for the cut,
 *    projection and discipline each of them declared.
 * 2. The design, every sheet, the schedule and the take-off report one opening
 *    count, and the schedule's rows sum to it.
 * 3. Adding one door to the design adds it to the plan, the schedule and the
 *    take-off at once, at the void's own area.
 * 4. Moving one wall changes every sheet that draws it and no sheet that the cut
 *    already removed it from.
 * 5. The finish plan fills the room its boundaries agree on and the ceiling plan
 *    names none, and each artifact declares the derivation it cannot perform
 *    rather than drawing a building that does not need it.
 * 6. Every sheet serializes to a sidecar carrying its own digest and the one
 *    environment they all came from.
 */
export const test_drawing_sheet_set = (): void => {
  const environment = drawingEnvironment();
  const views = sheetViews();
  const sheets = derive(environment, views);
  const schedule = deriveAutoMovieDrawingSchedule({
    environment,
    subject: "opening",
  });
  const quantities = measureAutoMovieQuantities({ environment });
  const total = (report: typeof quantities, subject: string): number =>
    report.findings.find((finding) => finding.subject === subject)!.total;

  // 1. Six questions asked of one design.
  TestValidator.equals(
    "every sheet answers for the one environment and the convention it declared",
    views.map(([name, view]) => [
      name,
      sheets[name]!.environment,
      sheets[name]!.view,
      sheets[name]!.projection,
      sheets[name]!.discipline,
      sheets[name]!.scale,
      view.scale,
    ]),
    [
      ["floor-plan", "atelier", "floor-plan", "plan", "architectural", 50, 50],
      [
        "ceiling-plan",
        "atelier",
        "ceiling-plan",
        "reflected-ceiling-plan",
        "ceiling",
        50,
        50,
      ],
      ["finish-plan", "atelier", "finish-plan", "plan", "finish", 50, 50],
      [
        "north-elevation",
        "atelier",
        "north-elevation",
        "elevation",
        "architectural",
        50,
        50,
      ],
      ["section-a", "atelier", "section-a", "section", "architectural", 50, 50],
      [
        "services-plan",
        "atelier",
        "services-plan",
        "plan",
        "mechanical",
        50,
        50,
      ],
    ],
  );

  // 2. One opening count, eight artifacts.
  TestValidator.equals(
    "the design, every sheet, the schedule and the take-off count one set of openings",
    [
      environment.openings.length,
      schedule.total,
      schedule.rows.reduce((sum, row) => sum + row.count, 0),
      total(quantities, "opening-count"),
      ...views.map(([name]) => sheets[name]!.openings.length),
    ],
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  );
  TestValidator.equals(
    "every sheet marks the openings the schedule lists, by the schedule's own ids",
    views.map(([name]) => sheets[name]!.openings.map((mark) => mark.opening)),
    views.map(() => ["front-door", "oculus", "vent"]),
  );

  // 3. One added door reaches every artifact at once.
  const extended = withSideDoor(environment);
  const extendedSheets = derive(extended, views);
  const extendedSchedule = deriveAutoMovieDrawingSchedule({
    environment: extended,
    subject: "opening",
  });
  const extendedQuantities = measureAutoMovieQuantities({
    environment: extended,
  });
  TestValidator.equals(
    "authoring one door adds one door to the plan, the schedule and the take-off",
    [
      extendedSheets["floor-plan"]!.openings.map((mark) => mark.opening),
      extendedSchedule.total,
      extendedSchedule.rows
        .filter((row) => row.kind === "door")
        .map((row) => [row.mark, row.width, row.height, row.count]),
      total(extendedQuantities, "opening-count"),
    ],
    [
      ["front-door", "oculus", "side-door", "vent"],
      4,
      // Two door types now, ordered by the model backing them: the leaf-backed
      // front door first, then the model-less void beside it.
      [
        ["door-01", 0.9, 2.1, 1],
        ["door-02", 1, 2.1, 1],
      ],
      4,
    ],
  );
  TestValidator.predicate(
    "the take-off grows by the new void's own area and by nothing else",
    nclose(total(quantities, "opening-area"), 1.89 + Math.PI * 0.09) &&
      nclose(
        total(extendedQuantities, "opening-area"),
        1.89 + Math.PI * 0.09 + 2.1,
      ),
  );

  // 4. One moved wall, and only the sheets that draw it.
  const movedSheets = derive(movedWall(environment), views);
  TestValidator.equals(
    "moving one wall moves every sheet that draws it and no sheet that does not",
    views.map(([name]) => [
      name,
      movedSheets[name]!.digest !== sheets[name]!.digest,
    ]),
    [
      ["floor-plan", true],
      // The ceiling plan looks up from 3.05 m and the section keeps what lies
      // beyond z = 3: both cuts removed the wall before it could be drafted, so
      // a wall that moves within the plan changes neither sheet. The voids they
      // still mark sit on the boundary's own face, which the element's
      // transform does not move.
      ["ceiling-plan", false],
      ["finish-plan", true],
      ["north-elevation", true],
      ["section-a", false],
      // A services plan draws footings, and the wall is not one.
      ["services-plan", false],
    ],
  );

  // 5. What each sheet fills in, and what it refuses to.
  TestValidator.equals(
    "the finish plan fills the room its boundaries agree on and the ceiling names none",
    [
      sheets["finish-plan"]!.regions.map((region) => [
        region.space,
        region.finish,
        region.area,
      ]),
      sheets["ceiling-plan"]!.regions.map((region) => [
        region.space,
        region.finish,
        region.area,
      ]),
      sheets["north-elevation"]!.regions.length,
    ],
    [[["hall", "plaster", 60]], [["roof-deck", null, 60]], 0],
  );
  TestValidator.equals(
    "each artifact names the derivation it cannot perform on this design",
    namedFacts([
      [
        "a finish plan says it cannot hatch a build-up it was never handed",
        () =>
          sheets["finish-plan"]!.gaps.find(
            (gap) => gap.subject === "material-build-up",
          )?.status === "unsupported",
      ],
      [
        "a services plan says it draws no network, only the elements it filtered",
        () =>
          sheets["services-plan"]!.gaps.find(
            (gap) => gap.subject === "service-network",
          )?.status === "unsupported",
      ],
      [
        "the schedule says it knows a door's size and not its performance",
        () =>
          schedule.gaps.find((gap) => gap.subject === "opening-performance")
            ?.status === "unsupported",
      ],
      [
        "the take-off says no material and no cut waste can be taken off yet",
        () =>
          ["material-quantity", "pattern-cut-waste"].every(
            (subject) =>
              quantities.gaps.find((gap) => gap.subject === subject)?.status ===
              "unsupported",
          ),
      ],
      [
        "every sheet declares that it classifies depth rather than occlusion",
        () =>
          views.every(
            ([name]) =>
              sheets[name]!.gaps.find(
                (gap) => gap.subject === "hidden-line-removal",
              )?.status === "unsupported",
          ),
      ],
    ]),
    {
      "a finish plan says it cannot hatch a build-up it was never handed": true,
      "a services plan says it draws no network, only the elements it filtered": true,
      "the schedule says it knows a door's size and not its performance": true,
      "the take-off says no material and no cut waste can be taken off yet": true,
      "every sheet declares that it classifies depth rather than occlusion": true,
    },
  );

  // 6. The sidecar of each sheet.
  TestValidator.predicate(
    "every sheet serializes as a sidecar of its own digest and one environment",
    views.every(([name, view]) => {
      const svg = autoMovieDrawingToSvg({ drawing: sheets[name]!, view });
      return (
        svg.includes('data-automovie-environment="atelier"') &&
        svg.includes(`data-automovie-view="${name}"`) &&
        svg.includes(`data-automovie-digest="${sheets[name]!.digest}"`) &&
        svg.endsWith("\n</svg>")
      );
    }),
  );
};

/** The six views one revision is asked for, in the order the case reads them. */
const sheetViews = (): Array<[string, IAutoMovieDrawingView]> => [
  ["floor-plan", drawingView({ id: "floor-plan" })],
  [
    "ceiling-plan",
    drawingView({
      id: "ceiling-plan",
      projection: "reflected-ceiling-plan",
      discipline: "ceiling",
      origin: { x: 0, y: 3.05, z: 0 },
      direction: { x: 0, y: 1, z: 0 },
      up: { x: 0, y: 0, z: -1 },
    }),
  ],
  ["finish-plan", drawingView({ id: "finish-plan", discipline: "finish" })],
  [
    "north-elevation",
    drawingView({
      id: "north-elevation",
      projection: "elevation",
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
    }),
  ],
  [
    "section-a",
    drawingView({
      id: "section-a",
      projection: "section",
      origin: { x: 0, y: 0, z: 3 },
      direction: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
    }),
  ],
  [
    "services-plan",
    drawingView({
      id: "services-plan",
      discipline: "mechanical",
      elementKinds: ["footing"],
    }),
  ],
];

/** Every view of one revision, keyed by the name the case calls it. */
const derive = (
  environment: IAutoMovieBuiltEnvironment,
  views: ReadonlyArray<[string, IAutoMovieDrawingView]>,
): Record<string, IAutoMovieDrawing> => {
  const output: Record<string, IAutoMovieDrawing> = {};
  for (const [name, view] of views)
    output[name] = deriveAutoMovieDrawing({ environment, view });
  return output;
};

/**
 * The same design with one more door, as a void of its own on the same face.
 *
 * Placed at x 4.5..5.5 so it clears the front door and the oculus: two voids
 * that touch are one void authored twice, and the design refuses that.
 */
const withSideDoor = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  openings: [
    ...environment.openings,
    {
      id: "side-door",
      kind: "door",
      boundary: "north",
      fill: null,
      profile: {
        outline: [
          { x: 4.5, y: 0 },
          { x: 5.5, y: 0 },
          { x: 5.5, y: 2.1 },
          { x: 4.5, y: 2.1 },
        ],
      },
    },
  ],
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
