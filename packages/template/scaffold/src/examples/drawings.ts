import {
  AUTOMOVIE_QUANTITY_SUBJECTS,
  autoMovieDrawingToSvg,
  deriveAutoMovieDrawing,
  deriveAutoMovieDrawingSchedule,
  measureAutoMovieQuantities,
} from "@automovie/engine";
import type {
  IAutoMovieDrawing,
  IAutoMovieDrawingSchedule,
  IAutoMovieDrawingView,
  IAutoMovieQuantityReport,
} from "@automovie/interface";

import { ExampleBuilding } from "./buildings";

/**
 * Asking a building for a drawing, instead of drafting one beside it.
 *
 * ## The one rule this example exists to teach
 *
 * A view is a **question asked of a design**, never a second copy of it.
 * Nothing below holds a wall, a dimension string or a door number: it states a
 * cut plane, a direction, a scale, a filter and a pen, and every line, region,
 * mark and quantity comes back out of the building the question was asked of.
 * That is the whole reason to derive rather than draft. A hand-drafted sheet
 * and a model disagree the moment either one moves, and a view cannot disagree
 * with the thing it is a projection of.
 *
 * The same design answers four different questions here, and none of the four
 * is allowed a private copy of the geometry: a plan, an opening schedule, a
 * quantity take-off, and the sheet a human reads. A door on the plan and a row
 * in the schedule are therefore the same door by construction, not by anybody
 * remembering to update both.
 *
 * ## A plan, a section and an elevation are one projection
 *
 * They differ in two decisions : where the cut plane is, and which side of it
 * survives : so the technique below is the whole of all four conventions. Move
 * `origin` up and the plan cuts higher; point `direction` sideways and the same
 * call returns a section; ask for `elevation` and nothing is cut at all.
 *
 * ## Notes are pinned to features, not to coordinates
 *
 * A note that says "2.4 m" beside a wall is a lie the moment the wall moves. A
 * note pinned to a feature is re-derived every time the drawing is taken, so it
 * either moves with the wall or says out loud that it could not find it. Both
 * outcomes are correct; a stale number that still looks right is the only wrong
 * one, and `count` is what separates "the wall moved" from "the wall is a
 * different wall".
 */
export const exampleFloorPlanView = (
  props: {
    /** Stable view identity; the SVG pen is matched against it. */
    id?: string;
    /** Open discipline label deciding nothing but what the sheet is called. */
    discipline?: string;
    /** Height of the cut plane above the storey's own slab, in metres. */
    cutHeight?: number;
    /** Drawing scale denominator: `50` means 1:50. */
    scale?: number;
    /** Logical spaces the sheet is restricted to; empty draws every space. */
    spaces?: string[];
    /** Element the note and the dimension are pinned to. */
    subject?: string;
    /** Second element the dimension measures to. */
    counterpart?: string;
  } = {},
): IAutoMovieDrawingView => {
  const subject = props.subject ?? "tower-partition-0";
  const counterpart = props.counterpart ?? "tower-slab-0";
  return {
    id: props.id ?? "example-plan-level-0",
    projection: "plan",
    discipline: props.discipline ?? "architectural",
    // Only the height matters to a plan; the other two components move the page
    // origin, which is what lets two views of one building share a coordinate
    // origin instead of being aligned by eye.
    origin: { x: 0, y: props.cutHeight ?? 1.2, z: 0 },
    direction: { x: 0, y: -1, z: 0 },
    // A plan conventionally puts world north up the page. The hint is
    // re-orthogonalized against the view direction, so the nearest cardinal
    // axis is enough and an exact in-plane vector is never needed.
    up: { x: 0, y: 0, z: -1 },
    scale: props.scale ?? 50,
    // No depth bound: nothing below the cut is pushed into `hidden`.
    depth: null,
    // The dashed convention every floor plan uses. Material the cut removed is
    // not simply gone: a beam or a mezzanine edge within this band is drawn
    // `overhead` rather than dropped.
    overhead: 1.5,
    // Descendants are included, so naming the storey also draws the room
    // inside it. A name the design does not declare selects nothing and is
    // reported as a gap rather than coming back as a quietly empty sheet.
    spaces: props.spaces ?? ["tower-storey-0"],
    // Empty draws every kind. A discipline sheet lists the kinds it owns here
    // and gets the same geometry kernel every other view uses, which is what
    // makes a mechanical plan a filter rather than a second model.
    elementKinds: [],
    dimensions: [
      {
        id: "partition-to-slab",
        from: {
          element: subject,
          part: null,
          kind: "centroid",
          index: 0,
          count: null,
        },
        to: {
          element: counterpart,
          part: null,
          kind: "centroid",
          index: 0,
          count: null,
        },
        // `page` measures the projected distance on the sheet, `world` the true
        // 3D distance. Across anything sloped the two are different numbers,
        // and a drawing that could not say which it meant would be unusable
        // for setting out.
        measure: "world",
      },
    ],
    annotations: [
      {
        id: "partition-note",
        text: "partition, storey 0",
        target: {
          element: subject,
          part: null,
          kind: "centroid",
          index: 0,
          count: null,
        },
      },
    ],
    // Line weight is the one part of a drawing measured on the paper rather
    // than in the world: a cut wall reads as a cut wall because its stroke is
    // heavy at every scale. Weights in metres would thin out as the scale
    // denominator grew.
    style: {
      weights: { cut: 0.5, projected: 0.25, overhead: 0.18, hidden: 0.13 },
      dashes: {
        cut: [],
        projected: [],
        overhead: [3, 2],
        hidden: [1.5, 1.5],
      },
      textHeight: 2.5,
    },
  };
};

/** The plan itself: linework, regions, opening marks, dimensions, notes. */
export const exampleFloorPlan = (): IAutoMovieDrawing =>
  deriveAutoMovieDrawing({
    environment: new ExampleBuilding().design(),
    view: exampleFloorPlanView(),
  });

/**
 * The opening schedule, counted by type off the same graph the plan drew.
 *
 * `total` is the design's own opening count by construction, which is what
 * makes the schedule and the sheet two readings rather than two documents.
 * Nominal sizes come from an opening's authored void where it has one, and from
 * the filling element's extent where it does not; the row says which, because a
 * leaf's bounding size is not the hole's and a schedule that printed both as
 * plain numbers would be ordered from.
 */
export const exampleOpeningSchedule = (): IAutoMovieDrawingSchedule =>
  deriveAutoMovieDrawingSchedule({
    environment: new ExampleBuilding().design(),
    subject: "opening",
  });

/**
 * The take-off: every quantity the design can answer for, and every one it
 * cannot.
 *
 * Every number is arithmetic over authored geometry : a footprint's area, a
 * void's arc area, a route's polyline length, a cell's decomposition : so a
 * quantity cannot fall out of date with the model it came from. Nothing is
 * looked up, defaulted, or carried over from a previous revision, and a subject
 * the design cannot support is a stated gap rather than a missing row.
 */
export const exampleQuantities = (): IAutoMovieQuantityReport =>
  measureAutoMovieQuantities({ environment: new ExampleBuilding().design() });

/**
 * The sheet, as a file that is simultaneously a picture and a sidecar.
 *
 * Every stroke carries the element it came from, the layer it belongs to and
 * its relation to the cut plane; every region carries its space and cell; every
 * gap the derivation declared is carried through as a marker. So a sheet cannot
 * look complete while its report says it is not, and a consumer never has to
 * match geometry to learn what it is looking at.
 *
 * The pen belongs to the view, so serializing a drawing with a different view's
 * pen is refused rather than silently restyled.
 */
export const exampleFloorPlanSheet = (): string =>
  autoMovieDrawingToSvg({
    drawing: exampleFloorPlan(),
    view: exampleFloorPlanView(),
  });

/**
 * Check the four readings against each other, not against a stored answer.
 *
 * Each assertion below is a claim one derivation makes about another, which is
 * the only kind a self-check can make without becoming a snapshot of whatever
 * the code currently emits. The schedule must count exactly the design's own
 * openings; the take-off must answer for every subject it declares; the pinned
 * note and dimension must have resolved against real features rather than gone
 * stale; and the sheet must carry one stroke for every line the drawing
 * drafted, or the file a human reads and the record a machine reads have come
 * apart.
 */
export const checkExampleDrawings = (): void => {
  const environment = new ExampleBuilding().design();
  const view = exampleFloorPlanView();
  const drawing = deriveAutoMovieDrawing({ environment, view });

  if (drawing.view !== view.id)
    throw new Error(
      `the drawing answers for view "${drawing.view}", not "${view.id}"`,
    );
  for (const dimension of drawing.dimensions)
    if (dimension.status !== "resolved")
      throw new Error(
        `dimension "${dimension.id}" is ${dimension.status}: ${dimension.reason}`,
      );
  for (const annotation of drawing.annotations)
    if (annotation.status !== "resolved")
      throw new Error(
        `annotation "${annotation.id}" is ${annotation.status}: ${annotation.reason}`,
      );

  const schedule = exampleOpeningSchedule();
  if (schedule.total !== environment.openings.length)
    throw new Error(
      `the design declares ${environment.openings.length} opening(s) but the schedule counted ${schedule.total}`,
    );

  const quantities = exampleQuantities();
  for (const subject of AUTOMOVIE_QUANTITY_SUBJECTS)
    if (!quantities.findings.some((finding) => finding.subject === subject))
      throw new Error(`the take-off never answered for "${subject}"`);

  const sheet = autoMovieDrawingToSvg({ drawing, view });
  const strokes = sheet.split('class="automovie-line"').length - 1;
  if (strokes !== drawing.lines.length)
    throw new Error(
      `the drawing drafted ${drawing.lines.length} line(s) but the sheet carried ${strokes}`,
    );
};
