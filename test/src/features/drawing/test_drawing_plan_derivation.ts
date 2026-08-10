import {
  autoMovieDrawingCutEdges,
  autoMovieDrawingFrame,
  autoMovieDrawingHasCut,
  autoMovieDrawingPartTriangles,
  autoMovieDrawingRange,
  autoMovieDrawingSilhouetteEdges,
  autoMovieDrawingWorldMatrices,
  deriveAutoMovieDrawing,
  lowerBuiltEnvironment,
  roundAutoMovieDrawingScalar,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawing,
  IAutoMovieDrawingLine,
  IAutoMovieDrawingView,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  drawingBoxModel,
  drawingCell,
  drawingEnvironment,
  drawingPlace,
  drawingView,
} from "../internal/drawingFixtures";
import {
  namedFacts,
  nclose,
  throwsError,
  vclose,
} from "../internal/predicates";

/** Order two ids the way every canonical list in the engine orders them. */
const byText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * One design answers a plan, a reflected ceiling plan, a section and an
 * elevation, and answers them the same way twice.
 *
 * Every number asserted below is hand arithmetic over the fixture, never a
 * snapshot of what the derivation emitted. The fixture wall is 6 m long and 0.2
 * m thick, so the plan cut through it is a 6 x 0.2 rectangle; the hall cell is
 * 10 x 6 on plan, so its cross-section is 60 m2; the slab is 10 x 6, so its
 * projected outline is the same rectangle. The point of the scenario is that
 * those four drawings are four questions asked of one model rather than four
 * drawings somebody kept in step.
 *
 * Scenarios:
 *
 * 1. The plan's frame, cut linework, projected outlines, region area, extent and
 *    opening marks are exactly the fixture's own dimensions.
 * 2. The reflected ceiling plan lands a ceiling element on the same page point the
 *    plan lands the floor under it, which is what "reflected" means, and it
 *    keeps what the plan removed.
 * 3. A section cuts vertically and an elevation cuts nothing; the elevation
 *    reports no region and no `cut` line at all.
 * 4. `depth` and `overhead` move geometry between `projected`, `hidden`,
 *    `overhead` and dropped, one band at a time.
 * 5. Space and element-kind filters restrict what is drawn, descendants included,
 *    an element outside every named space is dropped, and a filter naming a
 *    space the design never declared says so rather than returning a blank
 *    sheet.
 * 6. The same design and view derive a byte-identical drawing twice, and a moved
 *    wall changes the digest.
 * 7. The world transform the drawing derives is the world transform
 *    `lowerBuiltEnvironment` stages, element for element.
 * 8. A boundary that carries a face and no element draws itself as a closed solid;
 *    one realized by an element does not, so no wall is drafted twice; and a
 *    separation between two rooms is drawn on both of their sheets.
 * 9. An element citing a runtime model, an element with no geometry and a view
 *    that draws nothing are each reported rather than silently omitted.
 * 10. A degenerate view — zero direction, zero up, parallel up, bad scale, bad
 *     depth, non-finite origin — is refused at its own message, and an invalid
 *     design is refused before anything is drawn.
 * 11. A fifty-thousand-triangle model is sectioned rather than overflowing the call
 *     stack, and the fold that makes that true answers where a spread cannot.
 */
export const test_drawing_plan_derivation = (): void => {
  const environment = drawingEnvironment();
  const plan = deriveAutoMovieDrawing({
    environment,
    view: drawingView(),
  });

  TestValidator.equals(
    "the plan resolves the page basis a plan has",
    plan.frame,
    {
      origin: { x: 0, y: 1.2, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0, z: -1 },
      normal: { x: 0, y: 1, z: 0 },
    },
  );
  TestValidator.equals(
    "the plan carries the view's own identity and scale",
    [
      plan.version,
      plan.protocol,
      plan.view,
      plan.projection,
      plan.discipline,
      plan.scale,
      plan.environment,
    ],
    [
      1,
      "automovie.drawing.v1",
      "plan-ground",
      "plan",
      "architectural",
      50,
      "atelier",
    ],
  );

  // The wall spans x 0..6 and z 0..0.2, and the page up axis is -Z, so its cut
  // is the rectangle from (0, -0.2) to (6, 0). Each side of it arrives as two
  // collinear pieces because the box's faces are two triangles each.
  const wallCut = spans(plan.lines, "north-wall", "cut");
  TestValidator.equals(
    "the cut through the wall is the wall's own 6 x 0.2 section",
    wallCut,
    [
      [0, -0.2, 0, -0.12],
      [0, -0.2, 2.4, -0.2],
      [0, -0.12, 0, 0],
      [0, 0, 3.6, 0],
      [2.4, -0.2, 6, -0.2],
      [3.6, 0, 6, 0],
      [6, -0.2, 6, -0.08],
      [6, -0.08, 6, 0],
    ],
  );
  TestValidator.equals(
    "the slab under the cut is projected as its own 10 x 6 outline",
    spans(plan.lines, "floor-slab", "projected"),
    [
      [0, -6, 0, 0],
      [0, -6, 10, -6],
      [0, 0, 10, 0],
      [10, -6, 10, 0],
    ],
  );
  TestValidator.equals(
    "every drafted line names the element, space and kind it came from",
    [
      ...new Set(
        plan.lines.map((line) => `${line.owner}/${line.space}/${line.layer}`),
      ),
    ].sort(byText),
    [
      "door-leaf/hall/door-leaf",
      "floor-slab/hall/slab",
      "footing/hall/footing",
      "north-wall/hall/wall",
    ],
  );
  TestValidator.equals(
    "the hall's cross-section is the 10 x 6 room it was authored as",
    plan.regions,
    [
      {
        space: "hall",
        cell: "hall-cell",
        kind: "room",
        polygon: [
          { x: 10, y: -6 },
          { x: 10, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: -6 },
        ],
        area: 60,
        finish: "plaster",
      },
    ],
  );
  TestValidator.equals(
    "a space built from several cells sections each of them, in the cells' own order",
    deriveAutoMovieDrawing({
      environment: splitHall(environment),
      view: drawingView({ id: "split" }),
    }).regions.map((region) => [region.space, region.cell, region.area]),
    // The hall is authored as a 4 m bay and a 6 m bay, so the plan sections both
    // and each is its own bay's area rather than the room's.
    [
      ["hall", "hall-east", 36],
      ["hall", "hall-west", 24],
    ],
  );
  TestValidator.equals("the plan's extent is the slab it draws", plan.extent, {
    min: { x: 0, y: -6 },
    max: { x: 10, y: 0 },
  });
  TestValidator.equals(
    "every opening of the drawn boundary is marked, with the basis of each",
    plan.openings.map((mark) => [
      mark.opening,
      mark.basis,
      mark.width,
      mark.height,
    ]),
    [
      ["front-door", "profile", 0.9, 2.1],
      ["oculus", "profile", 0.6, 0.6],
      ["vent", "none", null, null],
    ],
  );
  TestValidator.equals(
    "the plan declares every derivation it did not perform",
    plan.gaps.map((gap) => [gap.subject, gap.status]),
    [
      ["curved-linework", "unsupported"],
      ["hidden-line-removal", "unsupported"],
      ["material-build-up", "unsupported"],
      ["opening-geometry", "not-run"],
      ["opening-void-subtraction", "unsupported"],
      ["service-network", "unsupported"],
    ],
  );

  // 2. Reflected ceiling plan.
  const ceiling = deriveAutoMovieDrawing({
    environment,
    view: drawingView({
      id: "rcp",
      projection: "reflected-ceiling-plan",
      discipline: "ceiling",
      origin: { x: 0, y: 3.05, z: 0 },
      direction: { x: 0, y: 1, z: 0 },
      up: { x: 0, y: 0, z: -1 },
    }),
  });
  TestValidator.equals(
    "the reflected plan mirrors its page right axis back onto the plan's",
    [ceiling.frame.right, ceiling.frame.up, ceiling.frame.normal],
    [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: -1, z: 0 },
    ],
  );
  TestValidator.equals(
    "the beam the plan removed is exactly what the ceiling plan cuts",
    [
      ceiling.lines.some(
        (line) => line.owner === "roof-beam" && line.role === "cut",
      ),
      plan.lines.some((line) => line.owner === "roof-beam"),
      ceiling.lines.some((line) => line.owner === "floor-slab"),
    ],
    [true, false, false],
  );
  TestValidator.equals(
    "a ceiling element lands on the page where the floor under it lands",
    pageSpanX(ceiling.lines, "roof-beam"),
    [0, 6],
  );
  TestValidator.equals(
    "the reflected plan reports the ceiling volume instead of the room",
    ceiling.regions.map((region) => [region.space, region.area]),
    [["roof-deck", 60]],
  );

  // 3. Section and elevation.
  const section = deriveAutoMovieDrawing({
    environment,
    view: drawingView({
      id: "section-a",
      projection: "section",
      origin: { x: 0, y: 0, z: 3 },
      direction: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
    }),
  });
  const elevation = deriveAutoMovieDrawing({
    environment,
    view: drawingView({
      id: "elevation-north",
      projection: "elevation",
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
    }),
  });
  TestValidator.equals(
    "a section cuts and an elevation does not",
    [
      autoMovieDrawingHasCut("section"),
      autoMovieDrawingHasCut("plan"),
      autoMovieDrawingHasCut("reflected-ceiling-plan"),
      autoMovieDrawingHasCut("elevation"),
      section.lines.some((line) => line.role === "cut"),
      elevation.lines.some((line) => line.role === "cut"),
      elevation.regions.length,
    ],
    [true, true, true, false, true, false, 0],
  );
  TestValidator.equals(
    "the section reports both storeys' cross-sections at their own widths",
    section.regions.map((region) => [region.space, region.area]),
    [
      ["hall", 30],
      ["roof-deck", 5],
    ],
  );
  TestValidator.equals(
    "the elevation draws the wall's whole 6 x 3 face",
    spans(elevation.lines, "north-wall", "projected"),
    [
      [-6, 0, -6, 3],
      [-6, 0, 0, 0],
      [-6, 3, 0, 3],
      [0, 0, 0, 3],
    ],
  );
  TestValidator.equals(
    "plan, section and elevation mark the same openings of the same boundaries",
    namedFacts([
      [
        "the three sheets agree on the opening set",
        () =>
          [plan, section, elevation].every(
            (drawing) =>
              drawing.openings.map((mark) => mark.opening).join(",") ===
              "front-door,oculus,vent",
          ),
      ],
      [
        "the three sheets agree on host boundary and fill",
        () =>
          [section, elevation].every((drawing) =>
            drawing.openings.every(
              (mark, index) =>
                mark.boundary === plan.openings[index]!.boundary &&
                mark.fill === plan.openings[index]!.fill &&
                mark.width === plan.openings[index]!.width,
            ),
          ),
      ],
      [
        "the facade elevation draws the oculus as the 0.6 m circle it is",
        () => {
          const oculus = elevation.openings.find(
            (mark) => mark.opening === "oculus",
          )!;
          const xs = oculus.polygon.map((point) => point.x);
          const ys = oculus.polygon.map((point) => point.y);
          return (
            nclose(Math.max(...xs) - Math.min(...xs), 0.6) &&
            nclose(Math.max(...ys) - Math.min(...ys), 0.6) &&
            oculus.polygon.length === 32
          );
        },
      ],
      [
        "the door void sits where the leaf that fills it stands",
        () => {
          const door = elevation.openings.find(
            (mark) => mark.opening === "front-door",
          )!;
          const leaf = pageSpanX(elevation.lines, "door-leaf");
          return (
            nclose(
              Math.min(...door.polygon.map((point) => point.x)),
              leaf[0]!,
            ) &&
            nclose(Math.max(...door.polygon.map((point) => point.x)), leaf[1]!)
          );
        },
      ],
    ]),
    {
      "the three sheets agree on the opening set": true,
      "the three sheets agree on host boundary and fill": true,
      "the facade elevation draws the oculus as the 0.6 m circle it is": true,
      "the door void sits where the leaf that fills it stands": true,
    },
  );

  // 4. Depth and overhead bands.
  const banded = deriveAutoMovieDrawing({
    environment,
    view: drawingView({ id: "banded", depth: 1.3, overhead: 2.3 }),
  });
  TestValidator.equals(
    "depth and overhead sort every element into its own band",
    roles(banded),
    {
      "door-leaf": ["cut"],
      "floor-slab": ["projected"],
      footing: ["hidden"],
      parapet: ["overhead"],
      "north-wall": ["cut"],
      "roof-beam": ["overhead"],
    },
  );
  TestValidator.equals(
    "an overhead band that stops short of a beam drops it rather than dashing it",
    roles(
      deriveAutoMovieDrawing({
        environment,
        view: drawingView({ id: "shallow", overhead: 1.5 }),
      }),
    ),
    {
      "door-leaf": ["cut"],
      "floor-slab": ["projected"],
      footing: ["projected"],
      "north-wall": ["cut"],
    },
  );
  TestValidator.equals(
    "an elevation reaches its own depth and reports what lies past it",
    roles(
      deriveAutoMovieDrawing({
        environment,
        view: drawingView({
          id: "elevation-shallow",
          projection: "elevation",
          origin: { x: 0, y: 0, z: 0.5 },
          direction: { x: 0, y: 0, z: 1 },
          up: { x: 0, y: 1, z: 0 },
          depth: 2,
        }),
      }),
    ),
    {
      // Everything within 2 m behind the picture plane is drafted; only the
      // beam, whose nearest face is 2.35 m behind it, falls past the depth.
      "door-leaf": ["projected"],
      "floor-slab": ["projected"],
      footing: ["projected"],
      "north-wall": ["projected"],
      parapet: ["projected"],
      "roof-beam": ["hidden"],
    },
  );

  // 5. Filters.
  TestValidator.equals(
    "a view filtered to one storey draws that storey's own rooms and nothing else",
    [
      ...new Set(
        deriveAutoMovieDrawing({
          environment,
          view: drawingView({
            id: "deck-only",
            spaces: ["roof-deck"],
            overhead: 3,
          }),
        }).lines.map((line) => line.owner),
      ),
    ].sort(byText),
    ["parapet", "roof-beam"],
  );
  TestValidator.equals(
    "a view filtered to the building root reaches every descendant space",
    deriveAutoMovieDrawing({
      environment,
      view: drawingView({ id: "whole", spaces: ["site"] }),
    }).lines.length,
    plan.lines.length,
  );
  TestValidator.equals(
    "a discipline view is a kind filter over the same geometry kernel",
    deriveAutoMovieDrawing({
      environment,
      view: drawingView({
        id: "mep",
        discipline: "mechanical",
        elementKinds: ["footing"],
      }),
    }).lines.map((line) => line.owner),
    ["footing", "footing", "footing", "footing"],
  );
  const filterGap = (spaces: string[], id: string) =>
    deriveAutoMovieDrawing({ environment, view: drawingView({ id, spaces }) });
  TestValidator.equals(
    "a filter naming a space the design never declared says so, and says which",
    namedFacts([
      [
        "a filter of only unknown names draws nothing and reports the names",
        () => {
          const sheet = filterGap(["level-2", "basement"], "unknown-only");
          const gap = sheet.gaps.find(
            (entry) => entry.subject === "view-space-filter",
          );
          return (
            sheet.lines.length === 0 &&
            sheet.regions.length === 0 &&
            gap?.status === "not-run" &&
            // Named in canonical order, not in whichever order the view listed
            // them, so one mistake reads the same however it was written down.
            gap.reason.includes("2 space(s)") &&
            gap.reason.includes("(basement, level-2)")
          );
        },
      ],
      [
        "one bad name beside a good one is still reported, and the good one draws",
        () => {
          const sheet = filterGap(["level-2", "hall"], "one-of-each");
          return (
            sheet.lines.length !== 0 &&
            sheet.gaps.some((entry) => entry.subject === "view-space-filter")
          );
        },
      ],
      [
        "a filter every name of which the design declares reports nothing",
        () =>
          filterGap(["hall"], "known-only").gaps.every(
            (entry) => entry.subject !== "view-space-filter",
          ),
      ],
      [
        "an unfiltered view has no filter to be wrong about",
        () => plan.gaps.every((entry) => entry.subject !== "view-space-filter"),
      ],
    ]),
    {
      "a filter of only unknown names draws nothing and reports the names": true,
      "one bad name beside a good one is still reported, and the good one draws": true,
      "a filter every name of which the design declares reports nothing": true,
      "an unfiltered view has no filter to be wrong about": true,
    },
  );
  TestValidator.equals(
    "an element in no named space is dropped by a space-filtered view",
    deriveAutoMovieDrawing({
      environment: spacelessSlab(environment),
      view: drawingView({ id: "filtered", spaces: ["hall"] }),
    }).lines.some((line) => line.owner === "floor-slab"),
    false,
  );

  // 6. Determinism.
  TestValidator.equals(
    "the same design and view derive the same bytes twice",
    deriveAutoMovieDrawing({
      environment: drawingEnvironment(),
      view: drawingView(),
    }).digest,
    plan.digest,
  );
  TestValidator.equals(
    "moving a wall changes the drawing it is drawn on",
    deriveAutoMovieDrawing({
      environment: movedWall(environment),
      view: drawingView(),
    }).digest === plan.digest,
    false,
  );

  // 7. The drawing and the staged scene stand in one place.
  const staged = new Map(
    lowerBuiltEnvironment(drawingEnvironment()).set!.map((node) => [
      node.node,
      node.position,
    ]),
  );
  const matrices = autoMovieDrawingWorldMatrices(environment);
  TestValidator.predicate(
    "every element the drawing places stands where the stage places it",
    environment.elements
      .filter((element) => element.model !== null)
      .every((element) => {
        const matrix = matrices.get(element.id)!;
        return vclose(
          { x: matrix[12]!, y: matrix[13]!, z: matrix[14]! },
          staged.get(`atelier/${element.id}`)!,
        );
      }),
  );

  // 8. Boundary faces.
  TestValidator.equals(
    "a boundary with a face and no element draws itself as a closed section",
    spans(
      deriveAutoMovieDrawing({
        environment,
        view: drawingView({
          id: "parapet-plan",
          origin: { x: 0, y: 3.05, z: 0 },
        }),
      }).lines,
      "parapet",
      "cut",
    ),
    [
      [0, -0.2, 0, -0.18],
      [0, -0.2, 9, -0.2],
      [0, -0.18, 0, 0],
      [0, 0, 9, 0],
      [9, -0.2, 10, -0.2],
      [9, 0, 10, 0],
      [10, -0.2, 10, -0.02],
      [10, -0.02, 10, 0],
    ],
  );
  TestValidator.equals(
    "a boundary an element already realizes is not drafted a second time",
    plan.lines.some((line) => line.owner === "north"),
    false,
  );
  const parapetLines = (
    where: IAutoMovieBuiltEnvironment,
    overrides: Partial<IAutoMovieDrawingView>,
  ): IAutoMovieDrawingLine[] =>
    deriveAutoMovieDrawing({
      environment: where,
      view: drawingView({ origin: { x: 0, y: 3.05, z: 0 }, ...overrides }),
    }).lines.filter((line) => line.owner === "parapet");
  TestValidator.equals(
    "a separation between two rooms is drawn on both of their sheets",
    namedFacts([
      [
        "either separated room, and their parent, draws the wall between them",
        () =>
          ["hall", "roof-deck", "site"].every(
            (space) =>
              parapetLines(partyParapet(environment), {
                id: `party-${space}`,
                spaces: [space],
              }).length === 8,
          ),
      ],
      [
        "the wall carries its own first space on both sheets, not the filter's",
        () =>
          ["hall", "roof-deck"].every((space) =>
            parapetLines(partyParapet(environment), {
              id: `party-space-${space}`,
              spaces: [space],
            }).every((line) => line.space === "hall"),
          ),
      ],
      [
        "a room the separation does not touch still does not draw it",
        () =>
          parapetLines(environment, { id: "hall-only", spaces: ["hall"] })
            .length === 0,
      ],
      [
        "a discipline that draws no parapet draws none of it either",
        () =>
          parapetLines(partyParapet(environment), {
            id: "party-walls-only",
            elementKinds: ["wall"],
          }).length === 0,
      ],
    ]),
    {
      "either separated room, and their parent, draws the wall between them": true,
      "the wall carries its own first space on both sheets, not the filter's": true,
      "a room the separation does not touch still does not draw it": true,
      "a discipline that draws no parapet draws none of it either": true,
    },
  );

  TestValidator.equals(
    "a room finished throughout in one material names it, whatever else it holds",
    deriveAutoMovieDrawing({
      environment: mixedFinish(environment),
      view: drawingView({ id: "finish", discipline: "finish" }),
    }).regions.map((region) => [region.space, region.finish]),
    [["hall", "plaster"]],
  );
  TestValidator.equals(
    "a room whose boundaries name no material names none rather than guessing",
    deriveAutoMovieDrawing({
      environment,
      view: drawingView({ id: "ceiling", origin: { x: 0, y: 3.05, z: 0 } }),
    }).regions.map((region) => [region.space, region.finish]),
    [["roof-deck", null]],
  );
  TestValidator.equals(
    "two elements on one layer are drafted in the order of their own ids",
    deriveAutoMovieDrawing({
      environment: oneLayer(environment),
      view: drawingView({ id: "layered" }),
    })
      .lines.filter((line) => line.layer === "slab")
      .map((line) => line.owner),
    [
      "floor-slab",
      "floor-slab",
      "floor-slab",
      "floor-slab",
      "footing",
      "footing",
      "footing",
      "footing",
    ],
  );

  // 9. What the derivation cannot draw.
  const external = externalModel(environment);
  const externalPlan = deriveAutoMovieDrawing({
    environment: external,
    view: drawingView({ id: "external" }),
  });
  TestValidator.equals(
    "an element citing a runtime model is reported rather than quietly dropped",
    [
      externalPlan.lines.some((line) => line.owner === "floor-slab"),
      externalPlan.gaps.find((gap) => gap.subject === "external-model-geometry")
        ?.status,
    ],
    [false, "not-run"],
  );
  TestValidator.equals(
    "an element whose model carries no geometry draws nothing and throws nothing",
    deriveAutoMovieDrawing({
      environment: emptyGeometry(environment),
      view: drawingView({ id: "empty" }),
    }).lines.some((line) => line.owner === "floor-slab"),
    false,
  );
  TestValidator.equals(
    "an edge that points at the viewer has no page length and is not drafted",
    deriveAutoMovieDrawing({
      environment: standingBlade(environment),
      view: drawingView({ id: "blade" }),
    })
      .lines.filter((line) => line.owner === "blade")
      .map((line) => [line.from, line.to]),
    // The blade is one open triangle standing on edge. Its upright edge runs
    // along the view direction and projects onto a single point, so there is no
    // stroke to draw; its other two edges both run between the same two page
    // points, so they are one stroke and not two.
    [
      [
        { x: 0.5, y: -1 },
        { x: 2.5, y: -3 },
      ],
    ],
  );
  const substituted = deriveAutoMovieDrawing({
    environment: leafOnlyOpenings(environment),
    view: drawingView({ id: "substituted" }),
  });
  TestValidator.equals(
    "an opening measured from its leaf says so, and the sheet says so too",
    [
      substituted.openings.map((mark) => [
        mark.opening,
        mark.basis,
        mark.width,
      ]),
      substituted.gaps.find((gap) => gap.subject === "opening-profile")?.status,
      substituted.gaps.some(
        (gap) => gap.subject === "opening-void-subtraction",
      ),
    ],
    [
      [
        // The leaf is 0.9 x 2.1 x 0.05, so this is the leaf's own width and not
        // the hole's; the twin's leaf draws nothing, so it proves nothing.
        ["front-door", "fill", 0.9],
        ["twin-door", "none", null],
        ["vent", "none", null],
      ],
      "not-run",
      // Nothing was drawn from a void, so there is no void to subtract.
      false,
    ],
  );
  const blank = deriveAutoMovieDrawing({
    environment,
    view: drawingView({
      id: "blank",
      // An elevation has no regions; a space with no openings and a kind
      // nothing matches leave the sheet with nothing at all on it.
      projection: "elevation",
      direction: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
      elementKinds: ["nothing-of-this-kind"],
      spaces: ["roof-deck"],
    }),
  });
  TestValidator.equals(
    "a view that draws nothing reports no extent instead of an empty box",
    [blank.lines.length, blank.regions.length, blank.extent],
    [0, 0, null],
  );

  // 10. Refusals.
  TestValidator.equals(
    "a degenerate view or an invalid design is refused at its own message",
    namedFacts([
      [
        "a zero direction is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingFrame(
                drawingView({ direction: { x: 0, y: 0, z: 0 } }),
              ),
            "direction must be non-zero",
          ),
      ],
      [
        "a zero up is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingFrame(drawingView({ up: { x: 0, y: 0, z: 0 } })),
            "up must be non-zero",
          ),
      ],
      [
        "an up parallel to the direction is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingFrame(drawingView({ up: { x: 0, y: -2, z: 0 } })),
            "must not be parallel to its direction",
          ),
      ],
      [
        "a non-finite direction is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingFrame(
                drawingView({ direction: { x: Number.NaN, y: -1, z: 0 } }),
              ),
            "direction must be finite on every axis",
          ),
      ],
      [
        "a non-finite up is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingFrame(
                drawingView({
                  up: { x: 0, y: 0, z: Number.POSITIVE_INFINITY },
                }),
              ),
            "up must be finite on every axis",
          ),
      ],
      [
        "a non-finite origin is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingFrame(
                drawingView({ origin: { x: 0, y: Number.NaN, z: 0 } }),
              ),
            "origin must be finite on every axis",
          ),
      ],
      [
        "a scale of zero is refused",
        () =>
          throwsError(
            () => autoMovieDrawingFrame(drawingView({ scale: 0 })),
            "scale must be a finite number > 0",
          ),
      ],
      [
        "a negative depth is refused",
        () =>
          throwsError(
            () => autoMovieDrawingFrame(drawingView({ depth: -1 })),
            "depth must be null or a finite number at or above zero",
          ),
      ],
      [
        "a non-finite overhead is refused",
        () =>
          throwsError(
            () => autoMovieDrawingFrame(drawingView({ overhead: Number.NaN })),
            "overhead must be null or a finite number at or above zero",
          ),
      ],
      [
        "a zero depth and a zero overhead are accepted",
        () =>
          deriveAutoMovieDrawing({
            environment,
            view: drawingView({ id: "flat", depth: 0, overhead: 0 }),
          }).lines.every(
            (line) => line.role === "cut" || line.role === "hidden",
          ),
      ],
      [
        "an invalid design is refused before anything is drawn",
        () =>
          throwsError(
            () =>
              deriveAutoMovieDrawing({
                environment: { ...environment, id: "  " },
                view: drawingView(),
              }),
            ["is invalid at", "building id must be non-empty"],
          ),
      ],
      [
        "a malformed mesh is refused rather than drawn as its even prefix",
        () =>
          throwsError(
            () =>
              autoMovieDrawingPartTriangles(
                drawingBoxModel({
                  id: "broken",
                  shape: { type: "box", width: 1, height: 1, depth: 1 },
                  material: "plaster",
                }),
                {
                  id: "broken-body",
                  name: null,
                  geometry: {
                    type: "mesh",
                    mesh: {
                      positions: [0, 0, 0, 1, 0],
                      normals: null,
                      uvs: null,
                      indices: null,
                      skin: null,
                    },
                  },
                  material: null,
                  attachedBone: null,
                  transform: null,
                },
              ),
            "which is not a multiple of 3",
          ),
      ],
      [
        "a triangle list that is not a multiple of three is refused",
        () =>
          throwsError(
            () => autoMovieDrawingPartTriangles(probeModel(), meshPart([0, 1])),
            "which is not a multiple of 3",
          ),
      ],
      [
        "an index outside the vertex list is refused rather than read past",
        () =>
          throwsError(
            () =>
              autoMovieDrawingPartTriangles(probeModel(), meshPart([0, 1, 3])),
            "index 3 is outside its 3 vertices",
          ) &&
          throwsError(
            () =>
              autoMovieDrawingPartTriangles(probeModel(), meshPart([0, 1, -1])),
            "index -1 is outside its 3 vertices",
          ) &&
          throwsError(
            () =>
              autoMovieDrawingPartTriangles(
                probeModel(),
                meshPart([0, 1, 1.5]),
              ),
            "index 1.5 is outside its 3 vertices",
          ),
      ],
      [
        "a non-indexed mesh takes its vertices in the order they were written",
        () =>
          autoMovieDrawingPartTriangles(probeModel(), meshPart(null)).length ===
          1,
      ],
      [
        "a triangle with one corner exactly on the cut plane is cut through it",
        () =>
          autoMovieDrawingCutEdges(plan.frame, [
            {
              // One corner sits on the y = 1.2 plane and the other two straddle
              // it: the section runs from that corner to the crossing opposite.
              a: { x: 0, y: 1.2, z: 0 },
              b: { x: 1, y: 2, z: 0 },
              c: { x: 1, y: 0.4, z: 0 },
            },
          ]).length === 1,
      ],
      [
        "a triangle wholly on one side of the cut plane is not cut at all",
        () =>
          autoMovieDrawingCutEdges(plan.frame, [
            {
              a: { x: 0, y: 2, z: 0 },
              b: { x: 1, y: 2, z: 0 },
              c: { x: 1, y: 3, z: 0 },
            },
          ]).length === 0,
      ],
      [
        "a lone triangle is its own silhouette on every edge",
        () =>
          autoMovieDrawingSilhouetteEdges(plan.frame, [
            {
              a: { x: 0, y: 0, z: 0 },
              b: { x: 1, y: 0, z: 0 },
              c: { x: 0, y: 0, z: 1 },
            },
          ]).length === 3,
      ],
      [
        "a sliver whose two corners weld onto one point drafts no edge between them",
        () =>
          autoMovieDrawingSilhouetteEdges(plan.frame, [
            {
              // Two corners a ten-millionth of a metre apart round onto the
              // same output point. The triangle is not degenerate — its normal
              // is small but real — yet its ring collapses to a single welded
              // pair, so the two faces of that pair agree and nothing is
              // drafted. A sliver thinner than the output grid draws nothing,
              // which is the only honest thing it can draw.
              a: { x: 0, y: 0, z: 0 },
              b: { x: 1e-7, y: 0, z: 0 },
              c: { x: 0, y: 0, z: 1 },
            },
          ]).length === 0,
      ],
      [
        "a collapsed triangle contributes no silhouette at all",
        () =>
          autoMovieDrawingSilhouetteEdges(plan.frame, [
            {
              a: { x: 0, y: 0, z: 0 },
              b: { x: 1, y: 0, z: 0 },
              c: { x: 2, y: 0, z: 0 },
            },
          ]).length === 0,
      ],
      [
        "negative zero rounds to zero so one coordinate has one spelling",
        () =>
          Object.is(roundAutoMovieDrawingScalar(-1e-9), 0) &&
          roundAutoMovieDrawingScalar(1.00000051) === 1.000001 &&
          roundAutoMovieDrawingScalar(1.00000049) === 1,
      ],
    ]),
    {
      "a zero direction is refused": true,
      "a zero up is refused": true,
      "an up parallel to the direction is refused": true,
      "a non-finite direction is refused": true,
      "a non-finite up is refused": true,
      "a non-finite origin is refused": true,
      "a scale of zero is refused": true,
      "a negative depth is refused": true,
      "a non-finite overhead is refused": true,
      "a zero depth and a zero overhead are accepted": true,
      "an invalid design is refused before anything is drawn": true,
      "a triangle list that is not a multiple of three is refused": true,
      "an index outside the vertex list is refused rather than read past": true,
      "a non-indexed mesh takes its vertices in the order they were written": true,
      "a triangle with one corner exactly on the cut plane is cut through it": true,
      "a triangle wholly on one side of the cut plane is not cut at all": true,
      "a malformed mesh is refused rather than drawn as its even prefix": true,
      "a lone triangle is its own silhouette on every edge": true,
      "a sliver whose two corners weld onto one point drafts no edge between them": true,
      "a collapsed triangle contributes no silhouette at all": true,
      "negative zero rounds to zero so one coordinate has one spelling": true,
    },
  );

  // 11. A building-sized model.
  TestValidator.equals(
    "a real model's worth of triangles is sectioned rather than overflowing the stack",
    namedFacts([
      [
        "the fold answers over a run no spread could pass as arguments",
        () => {
          // `Math.min(...values)` passes one argument per element and gives up
          // somewhere above a hundred thousand of them. The exact ceiling is
          // the platform's own stack, so the twin below is what pins that this
          // run is genuinely past it rather than merely large.
          const values = Array.from({ length: 200_000 }, (_, index) =>
            index === 12_345 ? -7 : index,
          );
          const range = autoMovieDrawingRange(values);
          return (
            range.min === -7 &&
            range.max === 199_999 &&
            throwsError(() => Math.min(...values), "call stack")
          );
        },
      ],
      [
        "an empty run folds to the identities rather than to a value",
        () => {
          const range = autoMovieDrawingRange([]);
          return (
            range.min === Number.POSITIVE_INFINITY &&
            range.max === Number.NEGATIVE_INFINITY
          );
        },
      ],
      [
        "a single value is both extremes, and an unsorted run keeps both ends",
        () => {
          const one = autoMovieDrawingRange([4]);
          const many = autoMovieDrawingRange([3, 1, 2]);
          return (
            one.min === 4 && one.max === 4 && many.min === 1 && many.max === 3
          );
        },
      ],
      [
        "a fifty-thousand-triangle model is sectioned at its own true radius",
        () => {
          // 160 bands is 50,880 triangles, so the classifier folds 152,640
          // corner distances: comfortably past the ceiling a spread has.
          const cut = deriveAutoMovieDrawing({
            environment: hugeMesh(environment, 160),
            view: drawingView({ id: "huge" }),
          }).lines.filter(
            (line) => line.owner === "door-leaf" && line.role === "cut",
          );
          const across = autoMovieDrawingRange(
            cut.flatMap((line) => [line.from.x, line.to.x]),
          );
          // The leaf becomes a unit sphere centred at world (1.5, 1.05, 0.1),
          // and the plan cuts it 0.15 m above that centre, so the section is a
          // circle of radius sqrt(1 - 0.15^2) about page x = 1.5. The drafted
          // ring is the inscribed polygon, so it falls short of that circle by
          // the sagitta of one band and by no more.
          const radius = Math.sqrt(1 - 0.15 * 0.15);
          const sagitta = radius * (1 - Math.cos(Math.PI / 160));
          return (
            cut.length >= 160 &&
            nclose(across.min, 1.5 - radius, sagitta) &&
            nclose(across.max, 1.5 + radius, sagitta)
          );
        },
      ],
    ]),
    {
      "the fold answers over a run no spread could pass as arguments": true,
      "an empty run folds to the identities rather than to a value": true,
      "a single value is both extremes, and an unsorted run keeps both ends": true,
      "a fifty-thousand-triangle model is sectioned at its own true radius": true,
    },
  );
};

/** A throwaway model whose only job is to carry one probe part. */
const probeModel = () =>
  drawingBoxModel({
    id: "probe",
    shape: { type: "box", width: 1, height: 1, depth: 1 },
    material: "plaster",
  });

/** One three-vertex mesh part with the triangle list under test. */
const meshPart = (indices: number[] | null) => ({
  id: "probe-body",
  name: null,
  geometry: {
    type: "mesh" as const,
    mesh: {
      positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
      normals: null,
      uvs: null,
      indices,
      skin: null,
    },
  },
  material: null,
  attachedBone: null,
  transform: null,
});

/** One owner's segments of one role, as flat page coordinates. */
const spans = (
  lines: readonly IAutoMovieDrawingLine[],
  owner: string,
  role: string,
): number[][] =>
  lines
    .filter((line) => line.owner === owner && line.role === role)
    .map((line) => [line.from.x, line.from.y, line.to.x, line.to.y]);

/** The page x range one owner's linework occupies. */
const pageSpanX = (
  lines: readonly IAutoMovieDrawingLine[],
  owner: string,
): number[] => {
  const xs = lines
    .filter((line) => line.owner === owner)
    .flatMap((line) => [line.from.x, line.to.x]);
  return [Math.min(...xs), Math.max(...xs)];
};

/** Which roles each owner was drafted in, ascending by owner. */
const roles = (drawing: IAutoMovieDrawing): Record<string, string[]> => {
  const output: Record<string, string[]> = {};
  for (const line of drawing.lines)
    output[line.owner] = [
      ...new Set([...(output[line.owner] ?? []), line.role]),
    ].sort(byText);
  return output;
};

/** The same design with the slab belonging to no logical space. */
const spacelessSlab = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  elements: environment.elements.map((element) =>
    element.id === "floor-slab" ? { ...element, space: null } : element,
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

/**
 * The same design with the slab's geometry owned by the compiler, not the
 * design.
 */
const externalModel = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: environment.models.filter((model) => model.id !== "slab"),
  modelReferences: ["slab"],
});

/**
 * The same design with a mixed-up but singly-finished wall.
 *
 * The wall gains a trim part bound to no material at all, and the boundary
 * gains an element whose geometry the compiler owns. Neither adds a finish, so
 * the room is still finished in one material and still says so.
 */
const mixedFinish = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  modelReferences: ["imported-panel"],
  elements: [
    ...environment.elements,
    {
      id: "panel",
      kind: "panel",
      parent: "shell",
      transform: drawingPlace(0, 0, 0),
      model: "imported-panel",
      space: "hall",
    },
  ],
  boundaries: environment.boundaries.map((boundary) =>
    boundary.id === "north"
      ? { ...boundary, elements: [...boundary.elements, "panel"] }
      : boundary,
  ),
  models: environment.models.map((model) =>
    model.id === "wall"
      ? {
          ...model,
          parts: [
            model.parts[0]!,
            { ...model.parts[0]!, id: "wall-trim", material: null },
          ],
        }
      : model,
  ),
});

/**
 * The same design with the hall authored as two bays instead of one room.
 *
 * The two cells together occupy exactly the volume the single cell did, so
 * anything that measures the room must still measure the room; what changes is
 * only how many cross-sections a plan of it has to draw.
 */
const splitHall = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  spaces: environment.spaces.map((space) =>
    space.id === "hall"
      ? {
          ...space,
          cells: [
            drawingCell(
              "hall-west",
              { x: 0, y: 0, z: 0 },
              { x: 4, y: 3, z: 6 },
            ),
            drawingCell(
              "hall-east",
              { x: 4, y: 0, z: 0 },
              { x: 10, y: 3, z: 6 },
            ),
          ],
        }
      : space,
  ),
});

/**
 * The same design plus one open triangle standing on edge below the cut.
 *
 * An open mesh is the only thing whose silhouette can contain an edge pointing
 * straight at the viewer: on a closed solid such an edge is shared by two faces
 * that agree, so it never becomes an outline. Here all three edges are boundary
 * edges, and one of them has no page length at all.
 */
const standingBlade = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: [
    ...environment.models,
    {
      ...environment.models.find((model) => model.id === "leaf")!,
      id: "blade-model",
      parts: [
        {
          ...environment.models.find((model) => model.id === "leaf")!.parts[0]!,
          geometry: {
            type: "mesh" as const,
            mesh: {
              positions: [0, 0, 0, 0, 1, 0, 2, 0, 2],
              normals: null,
              uvs: null,
              indices: [0, 1, 2],
              skin: null,
            },
          },
        },
      ],
    },
  ],
  elements: [
    ...environment.elements,
    {
      id: "blade",
      kind: "blade",
      parent: "shell",
      transform: drawingPlace(0.5, 0, 1),
      model: "blade-model",
      space: "hall",
    },
  ],
});

/**
 * The same design with no void anywhere and two doors backed by leaves.
 *
 * The front door's leaf has geometry and stands in for the hole it fills; the
 * twin's leaf carries vertices and no triangle, so nothing about it can be
 * measured. The oculus, which has a void and no leaf, is dropped so the sheet
 * has nothing measured from a profile on it at all.
 */
const leafOnlyOpenings = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  models: [
    ...environment.models,
    {
      ...environment.models.find((model) => model.id === "leaf")!,
      id: "hollow-leaf",
      parts: [
        {
          ...environment.models.find((model) => model.id === "leaf")!.parts[0]!,
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
    },
  ],
  elements: [
    ...environment.elements,
    {
      id: "twin-leaf",
      kind: "door-leaf",
      parent: "shell",
      transform: drawingPlace(4, 1.05, 0.1),
      model: "hollow-leaf",
      space: "hall",
    },
  ],
  openings: [
    {
      id: "front-door",
      kind: "door",
      boundary: "north",
      fill: "door-leaf",
    },
    { id: "twin-door", kind: "door", boundary: "north", fill: "twin-leaf" },
    { id: "vent", kind: "vent", boundary: "north", fill: null },
  ],
});

/** The same design with the footing declared on the slab's own layer. */
const oneLayer = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  elements: environment.elements.map((element) =>
    element.id === "footing" ? { ...element, kind: "slab" } : element,
  ),
});

/** The same design with the parapet separating the hall from the deck above it. */
const partyParapet = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  boundaries: environment.boundaries.map((boundary) =>
    boundary.id === "parapet"
      ? { ...boundary, spaces: ["hall", "roof-deck"] }
      : boundary,
  ),
});

/**
 * The same design with the door leaf replaced by a UV sphere of `bands` bands,
 * which is `2 * bands * (bands - 1)` triangles.
 *
 * Closed rather than a heap of loose faces because a real imported model is
 * closed, and a sphere because its section is one ring however finely it is
 * tessellated: the case has to put a building's worth of geometry through the
 * derivation without also asking the suite to sort a hundred thousand strokes.
 */
const hugeMesh = (
  environment: IAutoMovieBuiltEnvironment,
  bands: number,
): IAutoMovieBuiltEnvironment => {
  const positions: number[] = [0, 1, 0];
  for (let ring = 1; ring < bands; ++ring) {
    const polar = (Math.PI * ring) / bands;
    for (let step = 0; step < bands; ++step) {
      const azimuth = (2 * Math.PI * step) / bands;
      positions.push(
        Math.sin(polar) * Math.cos(azimuth),
        Math.cos(polar),
        Math.sin(polar) * Math.sin(azimuth),
      );
    }
  }
  positions.push(0, -1, 0);
  const south = positions.length / 3 - 1;
  const at = (ring: number, step: number): number =>
    1 + (ring - 1) * bands + (step % bands);
  const indices: number[] = [];
  for (let step = 0; step < bands; ++step)
    indices.push(0, at(1, step + 1), at(1, step));
  for (let ring = 1; ring + 1 < bands; ++ring)
    for (let step = 0; step < bands; ++step)
      indices.push(
        at(ring, step),
        at(ring, step + 1),
        at(ring + 1, step),
        at(ring, step + 1),
        at(ring + 1, step + 1),
        at(ring + 1, step),
      );
  for (let step = 0; step < bands; ++step)
    indices.push(south, at(bands - 1, step), at(bands - 1, step + 1));
  return {
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
                    positions,
                    normals: null,
                    uvs: null,
                    indices,
                    skin: null,
                  },
                },
              },
            ],
          }
        : model,
    ),
  };
};

/** The same design with the slab's model carrying an empty mesh. */
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
                  // Vertices but no triangle referencing them: the design is
                  // valid and the drawing has nothing to draw.
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
