import {
  AUTOMOVIE_DRAWING_SVG_MARGIN,
  autoMovieDrawingToSvg,
  deriveAutoMovieDrawing,
} from "@automovie/engine";
import { IAutoMovieDrawingView } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  drawingEnvironment,
  drawingStyle,
  drawingView,
} from "../internal/drawingFixtures";
import { namedFacts, throwsError } from "../internal/predicates";

/**
 * The sheet a person reads and the sidecar a machine reads are one file.
 *
 * Scale is honoured as drafting scale, so the arithmetic is checkable: at 1:50
 * one model metre is 20 page millimetres, the fixture plan is 10 m by 6 m, and
 * with a 10 mm margin on each side the sheet is exactly 220 mm by 140 mm. Page
 * y grows downward while the drawing's up axis grows upward, so the flip
 * happens once here and the top-left corner of the extent lands at the margin.
 *
 * Every mark carries what it came from. A line names its element, space, layer
 * and relation to the cut plane; a region names its logical space and cell; a
 * note names whether it resolved; and every gap the drawing declared is carried
 * through as its own marker, so a sheet cannot look complete while its own
 * report says it is not.
 *
 * Scenarios:
 *
 * 1. The sheet's size, viewBox and root attributes are the drawing's own scale and
 *    extent, to the millimetre.
 * 2. A line is placed by the scale and the flip, and carries the four attributes
 *    that make it addressable.
 * 3. Each role is stroked at its own authored weight, and only the dashed roles
 *    carry a dash pattern.
 * 4. A region, a measured opening, an unmeasured opening, a resolved dimension, a
 *    stale dimension, a resolved note and a stale note each emit their own
 *    element with their own status.
 * 5. Text is XML-escaped, so a note containing markup is a note and not markup.
 * 6. Every gap the drawing declared reaches the sheet.
 * 7. A drawing with nothing on it is a sheet of margins rather than a crash.
 * 8. The same drawing serializes to the same bytes twice.
 * 9. A pen that does not belong to the drawing, and a pen with a bad weight, dash
 *    or text height, are each refused at their own message.
 */
export const test_drawing_svg_sidecar = (): void => {
  const environment = drawingEnvironment();
  const view: IAutoMovieDrawingView = drawingView({
    id: "sheet",
    depth: 1.3,
    overhead: 2.3,
    dimensions: [
      {
        id: "wall-length",
        from: {
          element: "north-wall",
          part: null,
          kind: "vertex",
          index: 0,
          count: null,
        },
        to: {
          element: "north-wall",
          part: null,
          kind: "vertex",
          index: 4,
          count: null,
        },
        measure: "world",
      },
      {
        id: "lost",
        from: {
          element: "no-such-wall",
          part: null,
          kind: "vertex",
          index: 0,
          count: null,
        },
        to: {
          element: "north-wall",
          part: null,
          kind: "vertex",
          index: 4,
          count: null,
        },
        measure: "page",
      },
    ],
    annotations: [
      {
        id: "note",
        text: 'blockwork <"fair-faced"> & sealed',
        target: {
          element: "north-wall",
          part: null,
          kind: "centroid",
          index: 0,
          count: null,
        },
      },
      {
        id: "lost-note",
        text: "pinned to nothing",
        target: {
          element: "no-such-wall",
          part: null,
          kind: "centroid",
          index: 0,
          count: null,
        },
      },
    ],
  });
  const drawing = deriveAutoMovieDrawing({ environment, view });
  const svg = autoMovieDrawingToSvg({ drawing, view });
  const lines = svg.split("\n");

  // 1. The sheet is the drawing at its own scale.
  TestValidator.equals(
    "the sheet is the extent at 1:50 plus a margin on every side",
    lines[0],
    '<svg xmlns="http://www.w3.org/2000/svg" width="220.000mm" height="140.000mm" ' +
      'viewBox="0 0 220.000 140.000" ' +
      'data-automovie-protocol="automovie.drawing.v1" data-automovie-view="sheet" ' +
      'data-automovie-environment="atelier" data-automovie-projection="plan" ' +
      'data-automovie-discipline="architectural" data-automovie-scale="50.000" ' +
      `data-automovie-digest="${drawing.digest}">`,
  );
  TestValidator.equals(
    "the margin is the sheet's own border and the document closes",
    [AUTOMOVIE_DRAWING_SVG_MARGIN, lines[lines.length - 1]],
    [10, "</svg>"],
  );

  // 2-3. Lines.
  TestValidator.equals(
    "a cut line is placed by the scale and the flip, and says what drew it",
    lines.find(
      (line) =>
        line.includes('data-owner="north-wall"') &&
        line.includes('data-role="cut"'),
    ),
    // The wall's cut runs from page (0, -0.2) to (0, 0); the extent's top-left
    // is (0, 0), so x is the margin and y runs from the margin down by 0.2 m,
    // which is 4 mm at 1:50.
    '  <line class="automovie-line" data-owner="north-wall" data-space="hall" ' +
      'data-layer="wall" data-role="cut" x1="10.000" y1="14.000" x2="10.000" ' +
      'y2="12.400" stroke="currentColor" stroke-width="0.500" />',
  );
  TestValidator.equals(
    "each role is stroked at its own weight and only the dashed roles dash",
    namedFacts([
      [
        "the four roles carry the four authored weights",
        () =>
          (
            [
              ["cut", "0.500"],
              ["projected", "0.250"],
              ["overhead", "0.180"],
              ["hidden", "0.130"],
            ] as const
          ).every(([role, weight]) =>
            lines.some(
              (line) =>
                line.includes(`data-role="${role}"`) &&
                line.includes(`stroke-width="${weight}"`),
            ),
          ),
      ],
      [
        "overhead and hidden dash and cut and projected do not",
        () =>
          lines.some(
            (line) =>
              line.includes('data-role="overhead"') &&
              line.includes('stroke-dasharray="3.000,1.500"'),
          ) &&
          lines.some(
            (line) =>
              line.includes('data-role="hidden"') &&
              line.includes('stroke-dasharray="1.000,1.000"'),
          ) &&
          lines
            .filter(
              (line) =>
                line.includes('data-role="cut"') ||
                line.includes('data-role="projected"'),
            )
            .every((line) => line.includes("stroke-dasharray") === false),
      ],
    ]),
    {
      "the four roles carry the four authored weights": true,
      "overhead and hidden dash and cut and projected do not": true,
    },
  );

  // 4-6. Every other mark.
  TestValidator.equals(
    "every mark carries the design record it was derived from",
    namedFacts([
      [
        "a region names its space, cell, kind, finish and exact area",
        () =>
          lines.some(
            (line) =>
              line.startsWith('  <polygon class="automovie-region"') &&
              line.includes('data-space="hall"') &&
              line.includes('data-cell="hall-cell"') &&
              line.includes('data-kind="room"') &&
              line.includes('data-finish="plaster"') &&
              line.includes('data-area="60.000"'),
          ),
      ],
      [
        "a measured opening is drawn as its own void outline",
        () =>
          lines.some(
            (line) =>
              line.startsWith('  <polygon class="automovie-opening"') &&
              line.includes('data-opening="oculus"') &&
              line.includes('data-basis="profile"') &&
              line.includes('data-width="0.600"') &&
              line.includes('data-height="0.600"'),
          ),
      ],
      [
        "an opening nothing proves is still carried, as an empty marker",
        () =>
          lines.some(
            (line) =>
              line.startsWith('  <g class="automovie-opening"') &&
              line.includes('data-opening="vent"') &&
              line.includes('data-basis="none"') &&
              line.includes('data-width=""') &&
              line.includes('data-height=""'),
          ),
      ],
      [
        "a resolved dimension carries its measure and its value",
        () =>
          lines.some(
            (line) =>
              line.startsWith('  <line class="automovie-dimension"') &&
              line.includes('data-id="wall-length"') &&
              line.includes('data-status="resolved"') &&
              line.includes('data-measure="world"') &&
              line.includes('data-value="6.000"'),
          ),
      ],
      [
        "a stale dimension carries its reason and no geometry",
        () =>
          lines.some(
            (line) =>
              line.startsWith('  <g class="automovie-dimension"') &&
              line.includes('data-id="lost"') &&
              line.includes('data-status="stale"') &&
              line.includes("has no element") &&
              line.includes("x1=") === false,
          ),
      ],
      [
        "a resolved note is text at its own place and text height",
        () =>
          lines.some(
            (line) =>
              line.startsWith('  <text class="automovie-annotation"') &&
              line.includes('data-id="note"') &&
              line.includes('font-size="2.500"') &&
              line.endsWith("</text>"),
          ),
      ],
      [
        "a note containing markup is escaped into text, not into markup",
        () =>
          lines.some((line) =>
            line.includes(
              ">blockwork &lt;&quot;fair-faced&quot;&gt; &amp; sealed</text>",
            ),
          ),
      ],
      [
        "a stale note carries its reason and no position",
        () =>
          lines.some(
            (line) =>
              line.startsWith('  <g class="automovie-annotation"') &&
              line.includes('data-id="lost-note"') &&
              line.includes('data-status="stale"'),
          ),
      ],
      [
        "every gap the drawing declared reaches the sheet",
        () =>
          drawing.gaps.every((gap) =>
            lines.some(
              (line) =>
                line.startsWith('  <g class="automovie-gap"') &&
                line.includes(`data-subject="${gap.subject}"`) &&
                line.includes(`data-status="${gap.status}"`),
            ),
          ),
      ],
      [
        "an apostrophe in a declared reason is escaped rather than closing an attribute",
        () => lines.some((line) => line.includes("&apos;")),
      ],
    ]),
    {
      "a region names its space, cell, kind, finish and exact area": true,
      "a measured opening is drawn as its own void outline": true,
      "an opening nothing proves is still carried, as an empty marker": true,
      "a resolved dimension carries its measure and its value": true,
      "a stale dimension carries its reason and no geometry": true,
      "a resolved note is text at its own place and text height": true,
      "a note containing markup is escaped into text, not into markup": true,
      "a stale note carries its reason and no position": true,
      "every gap the drawing declared reaches the sheet": true,
      "an apostrophe in a declared reason is escaped rather than closing an attribute": true,
    },
  );

  // 7. A sheet with nothing on it.
  const blankView = drawingView({
    id: "blank",
    projection: "elevation",
    direction: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    elementKinds: ["nothing-of-this-kind"],
    spaces: ["roof-deck"],
  });
  const blank = autoMovieDrawingToSvg({
    drawing: deriveAutoMovieDrawing({ environment, view: blankView }),
    view: blankView,
  });
  TestValidator.equals(
    "a drawing with nothing on it is a sheet of margins",
    [
      blank.startsWith(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20.000mm" height="20.000mm"',
      ),
      blank.split("\n").filter((line) => line.includes("automovie-line"))
        .length,
    ],
    [true, 0],
  );

  TestValidator.equals(
    "a region with no finish and a line in no space are written as empty, not omitted",
    namedFacts([
      [
        "a ceiling region names no finish and says so with an empty attribute",
        () => {
          const ceilingView = drawingView({
            id: "ceiling",
            projection: "reflected-ceiling-plan",
            origin: { x: 0, y: 3.05, z: 0 },
            direction: { x: 0, y: 1, z: 0 },
            up: { x: 0, y: 0, z: -1 },
          });
          return autoMovieDrawingToSvg({
            drawing: deriveAutoMovieDrawing({
              environment,
              view: ceilingView,
            }),
            view: ceilingView,
          }).includes(
            'data-space="roof-deck" data-cell="deck-cell" data-kind="roof-deck" data-finish=""',
          );
        },
      ],
      [
        "a line whose element belongs to no space carries an empty space",
        () => {
          const plainView = drawingView({ id: "plain" });
          return autoMovieDrawingToSvg({
            drawing: deriveAutoMovieDrawing({
              environment: {
                ...environment,
                elements: environment.elements.map((element) =>
                  element.id === "floor-slab"
                    ? { ...element, space: null }
                    : element,
                ),
              },
              view: plainView,
            }),
            view: plainView,
          }).includes(
            'data-owner="floor-slab" data-space="" data-layer="slab"',
          );
        },
      ],
    ]),
    {
      "a ceiling region names no finish and says so with an empty attribute": true,
      "a line whose element belongs to no space carries an empty space": true,
    },
  );

  // 8. Determinism.
  TestValidator.equals(
    "the same drawing serializes to the same bytes twice",
    autoMovieDrawingToSvg({
      drawing: deriveAutoMovieDrawing({
        environment: drawingEnvironment(),
        view,
      }),
      view,
    }),
    svg,
  );

  // 9. Refusals.
  TestValidator.equals(
    "a pen that is not this drawing's, or is not a pen, is refused",
    namedFacts([
      [
        "another view's pen is refused rather than silently applied",
        () =>
          throwsError(
            () =>
              autoMovieDrawingToSvg({
                drawing,
                view: drawingView({ id: "some-other-view" }),
              }),
            'drawing "sheet" cannot be drawn with the pen of view "some-other-view"',
          ),
      ],
      [
        "a zero stroke weight is refused at the role that carries it",
        () =>
          throwsError(
            () =>
              autoMovieDrawingToSvg({
                drawing,
                view: withStyle(view, {
                  ...drawingStyle(),
                  weights: { ...drawingStyle().weights, overhead: 0 },
                }),
              }),
            "overhead stroke weight must be a finite number > 0, but was 0",
          ),
      ],
      [
        "a non-finite stroke weight is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingToSvg({
                drawing,
                view: withStyle(view, {
                  ...drawingStyle(),
                  weights: { ...drawingStyle().weights, cut: Number.NaN },
                }),
              }),
            "cut stroke weight must be a finite number > 0",
          ),
      ],
      [
        "a negative dash is refused at the role that carries it",
        () =>
          throwsError(
            () =>
              autoMovieDrawingToSvg({
                drawing,
                view: withStyle(view, {
                  ...drawingStyle(),
                  dashes: { ...drawingStyle().dashes, hidden: [1, -1] },
                }),
              }),
            "hidden dash pattern must hold only finite numbers > 0, but held -1",
          ),
      ],
      [
        "a zero text height is refused",
        () =>
          throwsError(
            () =>
              autoMovieDrawingToSvg({
                drawing,
                view: withStyle(view, { ...drawingStyle(), textHeight: 0 }),
              }),
            "text height must be a finite number > 0, but was 0",
          ),
      ],
      [
        "a solid pen with no dash at all is accepted",
        () =>
          autoMovieDrawingToSvg({
            drawing,
            view: withStyle(view, {
              ...drawingStyle(),
              dashes: { cut: [], projected: [], overhead: [], hidden: [] },
            }),
          }).includes("stroke-dasharray") === false,
      ],
    ]),
    {
      "another view's pen is refused rather than silently applied": true,
      "a zero stroke weight is refused at the role that carries it": true,
      "a non-finite stroke weight is refused": true,
      "a negative dash is refused at the role that carries it": true,
      "a zero text height is refused": true,
      "a solid pen with no dash at all is accepted": true,
    },
  );
};

/** The same view holding a different pen. */
const withStyle = (
  view: IAutoMovieDrawingView,
  style: IAutoMovieDrawingView["style"],
): IAutoMovieDrawingView => ({ ...view, style });
