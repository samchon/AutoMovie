import {
  AutoMovieDrawingRole,
  IAutoMovieBuiltBoundary,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawing,
  IAutoMovieDrawingAnnotation,
  IAutoMovieDrawingDimension,
  IAutoMovieDrawingExtent,
  IAutoMovieDrawingFrame,
  IAutoMovieDrawingGap,
  IAutoMovieDrawingLine,
  IAutoMovieDrawingOpeningMark,
  IAutoMovieDrawingPoint,
  IAutoMovieDrawingRegion,
  IAutoMovieDrawingView,
  IAutoMovieVector3,
} from "@automovie/interface";

import { validateBuiltEnvironment } from "../architecture/builtEnvironment";
import { Vector3 } from "../math/Vector3";
import {
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
} from "../render/renderDigest";
import { resolveAutoMovieDrawingFeature } from "./drawingFeature";
import {
  autoMovieBoundaryFacePoint,
  autoMovieBoundaryShellTriangles,
  autoMovieOpeningExtent,
  autoMovieOpeningFillExtent,
  autoMovieOpeningHasArc,
  autoMovieOpeningOutlinePoints,
} from "./drawingOpening";
import {
  AUTOMOVIE_DRAWING_EPSILON,
  IAutoMovieDrawingEdge,
  IAutoMovieDrawingTriangle,
  autoMovieDrawingCellSection,
  autoMovieDrawingCutEdges,
  autoMovieDrawingFrame,
  autoMovieDrawingHasCut,
  autoMovieDrawingPartTriangles,
  autoMovieDrawingPlaneDistance,
  autoMovieDrawingPolygonArea,
  autoMovieDrawingRange,
  autoMovieDrawingSilhouetteEdges,
  autoMovieDrawingWorldMatrices,
  clipAutoMovieDrawingTriangles,
  projectAutoMovieDrawingPoint,
  roundAutoMovieDrawingScalar,
  transformAutoMovieDrawingTriangles,
} from "./drawingProjection";

/** Order the four line roles are drafted and sorted in. */
const ROLE_ORDER: AutoMovieDrawingRole[] = [
  "cut",
  "projected",
  "overhead",
  "hidden",
];

/** One thing the view draws, reduced to what drafting needs to know about it. */
interface IDrawable {
  id: string;
  kind: string;
  space: string | null;
  triangles: IAutoMovieDrawingTriangle[];
}

/**
 * Derive one drawing from one design.
 *
 * The design is validated first and an invalid one throws, for the same reason
 * `lowerBuiltEnvironment` refuses to lower one: a drawing of a building whose
 * graph does not resolve would be a picture of nothing, handed on as evidence.
 *
 * Everything below is computed. No line is drafted by hand, no dimension is
 * typed, and nothing produced here may be read back into the design: the
 * drawing is a projection of the model, so the two cannot disagree and the
 * model stays the only source of truth. What the derivation cannot compute is
 * reported in {@link IAutoMovieDrawing.gaps} rather than omitted, because a
 * sheet that silently leaves out what it could not work out reads as a building
 * that has none of it.
 *
 * @author Samchon
 */
export const deriveAutoMovieDrawing = (props: {
  /** Design the drawing is taken from. */
  environment: IAutoMovieBuiltEnvironment;
  /** View that decides the cut, the direction, the filter and the pen. */
  view: IAutoMovieDrawingView;
}): IAutoMovieDrawing => {
  const { environment, view } = props;
  const validated = validateBuiltEnvironment({ environment });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `built environment "${environment.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
  const frame = autoMovieDrawingFrame(view);
  const matrices = autoMovieDrawingWorldMatrices(environment);
  const cut = autoMovieDrawingHasCut(view.projection);
  const spaces = includedSpaces(environment, view);
  const drawn = (kind: string, space: string | null): boolean =>
    (view.elementKinds.length === 0 || view.elementKinds.includes(kind)) &&
    (spaces === null || (space !== null && spaces.has(space)));

  const drafted: IAutoMovieDrawingLine[] = [];
  const gaps: IAutoMovieDrawingGap[] = [];
  // A space is a reference into the design's own graph, so a filter naming one
  // the design does not declare is a dangling reference and is reported like
  // every other: the sheet that comes back would otherwise be a blank one with
  // nothing on it to say why. An element kind is deliberately not treated the
  // same way, because kinds are an open vocabulary with no registry to be
  // absent from, and a discipline that matches nothing is an honest empty
  // sheet rather than a mistake.
  const unknownSpaces = view.spaces
    .filter((id) => !environment.spaces.some((space) => space.id === id))
    .sort(compareAutoMovieRenderIds);
  if (unknownSpaces.length !== 0)
    gaps.push({
      subject: "view-space-filter",
      status: "not-run",
      reason: `the view restricts itself to ${unknownSpaces.length} space(s) this design does not declare (${unknownSpaces.join(", ")}), so nothing could be selected for them`,
      remedy:
        "name a space the design declares, or clear the filter to draw every space",
    });
  const drawables: IDrawable[] = [];
  let unresolvedModels = 0;

  for (const element of environment.elements) {
    if (!drawn(element.kind, element.space)) continue;
    if (element.model === null) continue;
    const model = environment.models.find(
      (candidate) => candidate.id === element.model,
    );
    if (model === undefined) {
      ++unresolvedModels;
      continue;
    }
    drawables.push({
      id: element.id,
      kind: element.kind,
      space: element.space,
      triangles: transformAutoMovieDrawingTriangles(
        matrices.get(element.id)!,
        model.parts.flatMap((part) =>
          autoMovieDrawingPartTriangles(model, part),
        ),
      ),
    });
  }
  for (const boundary of environment.boundaries) {
    // A boundary realized by elements is already drawn by them; drafting its
    // face as well would put two pens on one wall. A boundary that carries a
    // face and nothing else is the only thing in the design that knows where
    // that separation is, so it draws itself.
    if (boundary.face === undefined || boundary.elements.length !== 0) continue;
    // A separation belongs to both the spaces it separates, so a view filtered
    // to either of them draws it. Asking only about the first would drop the
    // party wall from every sheet that names the room on the far side of it,
    // and which side that is would be decided by the order the design happened
    // to list the two rooms in. The openings on the same boundary already read
    // it that way, and the boundary must not disagree with its own openings.
    if (!boundary.spaces.some((candidate) => drawn(boundary.kind, candidate)))
      continue;
    // Validation already refused a boundary that cites no space, so the first
    // one always exists and drafting it needs no absent case. The line carries
    // that first space rather than whichever one the filter reached, so a wall
    // reads the same on both of its rooms' sheets.
    const space = boundary.spaces[0]!;
    drawables.push({
      id: boundary.id,
      kind: boundary.kind,
      space,
      triangles: autoMovieBoundaryShellTriangles(boundary.face),
    });
  }

  for (const drawable of drawables) {
    if (drawable.triangles.length === 0) continue;
    // Signed distances from the cut plane, positive on the viewer's side, so
    // the smallest is the deepest corner of the thing and the largest the one
    // closest to the viewer. Every band below is a question about one of those
    // two and about nothing in between.
    const distance = autoMovieDrawingRange(
      drawable.triangles.flatMap((triangle) =>
        [triangle.a, triangle.b, triangle.c].map((corner) =>
          autoMovieDrawingPlaneDistance(frame, corner),
        ),
      ),
    );
    if (cut && distance.min > AUTOMOVIE_DRAWING_EPSILON) {
      // Wholly on the viewer's side: the cut removed it, and it is drafted as
      // overhead only while it stays inside the band the view declared.
      if (view.overhead === null || distance.min > view.overhead) continue;
      push(drafted, drawable, "overhead", frame, drawable.triangles, cut);
      continue;
    }
    if (view.depth !== null && distance.max < -view.depth) {
      push(drafted, drawable, "hidden", frame, drawable.triangles, cut);
      continue;
    }
    if (cut)
      for (const edge of autoMovieDrawingCutEdges(frame, drawable.triangles))
        append(drafted, drawable, "cut", frame, edge);
    push(drafted, drawable, "projected", frame, drawable.triangles, cut);
  }

  // Two edges of one solid can project onto one page segment — the near and far
  // rings of a wall seen face-on are the same stroke — and a drawing draws each
  // stroke once, so the sheet, its digest and its size stay properties of what
  // is drawn rather than of how the geometry happened to be built.
  const unique = new Map<string, IAutoMovieDrawingLine>();
  for (const line of drafted) unique.set(lineKey(line), line);
  const lines = [...unique.values()];

  if (unresolvedModels !== 0)
    gaps.push({
      subject: "external-model-geometry",
      status: "not-run",
      reason: `${unresolvedModels} drawn element(s) cite a compiler-owned runtime model whose geometry this design does not carry`,
      remedy:
        "author the element's geometry as an environment-owned model, or derive the drawing after the compiler has resolved the external asset",
    });

  const regions: IAutoMovieDrawingRegion[] = [];
  let unbounded = 0;
  if (cut)
    for (const space of environment.spaces) {
      if (spaces !== null && !spaces.has(space.id)) continue;
      for (const cell of space.cells) {
        const section = autoMovieDrawingCellSection(frame, cell.planes);
        if (section.bounded === false) {
          ++unbounded;
          continue;
        }
        if (section.polygon.length < 3) continue;
        const polygon = section.polygon.map(round);
        regions.push({
          space: space.id,
          cell: cell.id,
          kind: space.kind,
          polygon,
          area: roundAutoMovieDrawingScalar(
            autoMovieDrawingPolygonArea(polygon),
          ),
          finish: finishOf(environment, space.id),
        });
      }
    }
  if (unbounded !== 0)
    gaps.push({
      // `not-run` rather than `unsupported`, and the same word the quantity
      // report uses for the same subject: sectioning a cell is a derivation
      // that exists and works, and what is missing is a cell closed enough to
      // run it on. Two artifacts naming one subject must not disagree about
      // whose fault it is.
      subject: "unbounded-space-cell",
      status: "not-run",
      reason: `${unbounded} logical cell(s) are not bounded by their own half-spaces, so their cross-section has no finite outline`,
      remedy:
        "close each cell with enough half-spaces to bound it, or split the region into bounded cells",
    });

  const openings: IAutoMovieDrawingOpeningMark[] = [];
  let unprovenOpenings = 0;
  let substitutedOpenings = 0;
  let arcedOpenings = 0;
  for (const opening of environment.openings) {
    const boundary = environment.boundaries.find(
      (candidate) => candidate.id === opening.boundary,
    )!;
    if (
      spaces !== null &&
      !boundary.spaces.some((candidate) => spaces.has(candidate))
    )
      continue;
    const mark = openingMark(environment, matrices, frame, opening, boundary);
    openings.push(mark);
    if (mark.basis === "none") ++unprovenOpenings;
    if (mark.basis === "fill") ++substitutedOpenings;
    if (
      mark.basis === "profile" &&
      autoMovieOpeningHasArc(opening.profile!) === true
    )
      ++arcedOpenings;
  }
  if (unprovenOpenings !== 0)
    gaps.push({
      subject: "opening-geometry",
      status: "not-run",
      reason: `${unprovenOpenings} drawn opening(s) carry neither a void of their own on a boundary face nor a filling element with geometry, so nothing in the design says where or how large they are`,
      remedy:
        "give the opening a profile on a boundary that carries a face, or a filling element with geometry",
    });
  if (substitutedOpenings !== 0)
    gaps.push({
      subject: "opening-profile",
      status: "not-run",
      reason: `${substitutedOpenings} drawn opening(s) have no void of their own, so their size is the filling element's extent, which is the leaf and not the hole`,
      remedy:
        "author the opening's profile on its host boundary's face, then re-derive",
    });
  if (arcedOpenings !== 0)
    gaps.push({
      subject: "curved-linework",
      status: "unsupported",
      reason: `${arcedOpenings} drawn opening(s) have arc edges, which are drafted as chords at a fixed density rather than as true curve segments`,
      remedy:
        "read the chorded outline as linework; the scheduled width and height are computed from the arcs themselves and are exact",
    });
  if (openings.some((mark) => mark.basis === "profile"))
    gaps.push({
      subject: "opening-void-subtraction",
      status: "unsupported",
      reason:
        "an opening's void is drafted as its own outline over its host's linework rather than subtracted from it, so the host reads as unbroken behind the opening",
      remedy:
        "read the opening outline as the void; subtract it from the host once boolean linework exists",
    });

  gaps.push(
    {
      subject: "hidden-line-removal",
      status: "unsupported",
      reason:
        "linework is classified by its relation to the cut plane and the view depth, not by what occludes it, so an element behind another is drafted as though it were visible",
      remedy:
        "read the depth classification as drafting semantics rather than visibility, or render the view and read occlusion from the semantic mask",
    },
    {
      subject: "material-build-up",
      status: "unsupported",
      reason:
        "a region's finish is the surface material bound to the elements realizing its boundaries; a material assembly is a separate record from the built environment, this derivation is handed only the environment, and nothing here hatches a layer order, a thickness or a coursing pattern even when one is authored",
      remedy:
        "extend the derivation to accept the work's material assemblies, then hatch each cut boundary by its own layers",
    },
    {
      subject: "service-network",
      status: "unsupported",
      reason:
        "a service network is a separate record from the built environment, this derivation is handed only the environment, and nothing here draws a segment, a port or a penetration even when one is authored, so a services view is a kind-filtered projection of ordinary elements rather than a network-aware one",
      remedy:
        "extend the derivation to accept the work's service networks, then draw their segments, ports and penetrations as their own linework",
    },
  );

  const dimensions: IAutoMovieDrawingDimension[] = view.dimensions.map(
    (spec) => {
      const from = resolveAutoMovieDrawingFeature(
        environment,
        spec.from,
        matrices,
      );
      const to = resolveAutoMovieDrawingFeature(environment, spec.to, matrices);
      if (from.status === "stale" || to.status === "stale")
        return {
          id: spec.id,
          measure: spec.measure,
          status: "stale",
          from: null,
          to: null,
          value: null,
          reason: from.status === "stale" ? from.reason : to.reason,
        };
      const pageFrom = round(projectAutoMovieDrawingPoint(frame, from.point!));
      const pageTo = round(projectAutoMovieDrawingPoint(frame, to.point!));
      return {
        id: spec.id,
        measure: spec.measure,
        status: "resolved",
        from: pageFrom,
        to: pageTo,
        value: roundAutoMovieDrawingScalar(
          spec.measure === "world"
            ? Vector3.length(Vector3.subtract(to.point!, from.point!))
            : Math.hypot(pageTo.x - pageFrom.x, pageTo.y - pageFrom.y),
        ),
        reason: null,
      };
    },
  );

  const annotations: IAutoMovieDrawingAnnotation[] = view.annotations.map(
    (spec) => {
      const resolution = resolveAutoMovieDrawingFeature(
        environment,
        spec.target,
        matrices,
      );
      return resolution.status === "stale"
        ? {
            id: spec.id,
            text: spec.text,
            status: "stale",
            at: null,
            reason: resolution.reason,
          }
        : {
            id: spec.id,
            text: spec.text,
            status: "resolved",
            at: round(projectAutoMovieDrawingPoint(frame, resolution.point!)),
            reason: null,
          };
    },
  );

  if (annotations.some((annotation) => annotation.status === "resolved"))
    gaps.push({
      subject: "note-text-extent",
      status: "unsupported",
      reason:
        "a note resolves to the page point its text is set from, and the width and height of the glyphs that text becomes are not measured, because the derivation carries no font metrics",
      remedy:
        "read the note's position as an anchor and measure the set text in whatever renders it; the drawing's extent holds every note's anchor and not necessarily its last letter",
    });

  lines.sort(compareLines);
  regions.sort(
    (left, right) =>
      compareAutoMovieRenderIds(left.space, right.space) ||
      compareAutoMovieRenderIds(left.cell, right.cell),
  );
  openings.sort((left, right) =>
    compareAutoMovieRenderIds(left.opening, right.opening),
  );
  gaps.sort((left, right) =>
    compareAutoMovieRenderIds(left.subject, right.subject),
  );

  const drawing: Omit<IAutoMovieDrawing, "digest"> = {
    version: 1,
    protocol: "automovie.drawing.v1",
    view: view.id,
    projection: view.projection,
    discipline: view.discipline,
    scale: view.scale,
    environment: environment.id,
    frame: roundFrame(frame),
    extent: extentOf(lines, regions, openings, dimensions, annotations),
    lines,
    regions,
    openings,
    dimensions,
    annotations,
    gaps,
  };
  return { ...drawing, digest: autoMovieRenderDigest(canonical(drawing)) };
};

/**
 * The logical spaces a view draws, descendants included, or `null` for all.
 *
 * Descendants are included because a view filtered to a storey means the rooms
 * in it, not the storey record itself; a filter that stopped at the named space
 * would draw an empty sheet for every building that partitions its floors.
 */
const includedSpaces = (
  environment: IAutoMovieBuiltEnvironment,
  view: IAutoMovieDrawingView,
): Set<string> | null => {
  if (view.spaces.length === 0) return null;
  const included = new Set<string>(view.spaces);
  let changed = true;
  while (changed) {
    changed = false;
    for (const space of environment.spaces)
      if (
        space.parent !== null &&
        included.has(space.parent) &&
        !included.has(space.id)
      ) {
        included.add(space.id);
        changed = true;
      }
  }
  return included;
};

/**
 * The one surface material every element realizing a space's boundaries agrees
 * on, or `null`.
 *
 * A room finished throughout in one material names it; a room whose boundaries
 * disagree names none rather than picking the first, because a finish plan that
 * silently chose one wall's material would be read as a specification.
 */
const finishOf = (
  environment: IAutoMovieBuiltEnvironment,
  space: string,
): string | null => {
  const materials = new Set<string>();
  for (const boundary of environment.boundaries) {
    if (!boundary.spaces.includes(space)) continue;
    for (const id of boundary.elements) {
      const element = environment.elements.find(
        (candidate) => candidate.id === id,
      )!;
      const model = environment.models.find(
        (candidate) => candidate.id === element.model,
      );
      if (model === undefined) continue;
      for (const part of model.parts)
        if (part.material !== null) materials.add(part.material);
    }
  }
  return materials.size === 1 ? [...materials][0]! : null;
};

/**
 * One opening as the drawing can state it, and where that statement came from.
 *
 * The opening's own void on its host boundary's face is preferred over
 * everything else, because it is the only record that describes the hole rather
 * than something standing in it. A filling element is the fallback and is
 * labelled as such: a leaf's bounding extent is a door's size, and reporting it
 * as the opening's would quietly turn a stand-in into a measurement.
 */
const openingMark = (
  environment: IAutoMovieBuiltEnvironment,
  matrices: ReadonlyMap<string, number[]>,
  frame: IAutoMovieDrawingFrame,
  opening: IAutoMovieBuiltEnvironment["openings"][number],
  boundary: IAutoMovieBuiltBoundary,
): IAutoMovieDrawingOpeningMark => {
  const identity = {
    opening: opening.id,
    boundary: opening.boundary,
    kind: opening.kind,
    fill: opening.fill,
  };
  // Validation already refuses a void whose host boundary declares no face, so
  // a stated profile always has a face to be placed on; re-testing it here
  // would be a branch no validated design can take.
  if (opening.profile !== undefined) {
    const extent = autoMovieOpeningExtent(opening.profile);
    return {
      ...identity,
      basis: "profile",
      polygon: autoMovieOpeningOutlinePoints(opening.profile).map((point) =>
        round(
          projectAutoMovieDrawingPoint(
            frame,
            autoMovieBoundaryFacePoint(boundary.face!, point),
          ),
        ),
      ),
      width: extent.width,
      height: extent.height,
    };
  }
  const element =
    opening.fill === null
      ? undefined
      : environment.elements.find((candidate) => candidate.id === opening.fill);
  const model =
    element === undefined
      ? undefined
      : environment.models.find((candidate) => candidate.id === element.model);
  if (element === undefined || model === undefined)
    return {
      ...identity,
      basis: "none",
      polygon: [],
      width: null,
      height: null,
    };
  const corners = transformAutoMovieDrawingTriangles(
    matrices.get(element.id)!,
    model.parts.flatMap((part) => autoMovieDrawingPartTriangles(model, part)),
  ).flatMap((triangle) => [triangle.a, triangle.b, triangle.c]);
  if (corners.length === 0)
    return {
      ...identity,
      basis: "none",
      polygon: [],
      width: null,
      height: null,
    };
  return {
    ...identity,
    basis: "fill",
    polygon: [],
    ...autoMovieOpeningFillExtent(corners),
  };
};

const push = (
  lines: IAutoMovieDrawingLine[],
  drawable: IDrawable,
  role: AutoMovieDrawingRole,
  frame: IAutoMovieDrawingFrame,
  triangles: readonly IAutoMovieDrawingTriangle[],
  cut: boolean,
): void => {
  const kept =
    cut && role !== "overhead"
      ? clipAutoMovieDrawingTriangles(frame, triangles)
      : triangles;
  for (const edge of autoMovieDrawingSilhouetteEdges(frame, kept)) {
    // A silhouette edge lying in the cut plane is the boundary the clip just
    // created, and the cut linework already draws it; drafting it twice would
    // put a light pen exactly under a heavy one.
    if (
      cut &&
      Math.abs(autoMovieDrawingPlaneDistance(frame, edge.from)) <=
        AUTOMOVIE_DRAWING_EPSILON &&
      Math.abs(autoMovieDrawingPlaneDistance(frame, edge.to)) <=
        AUTOMOVIE_DRAWING_EPSILON
    )
      continue;
    append(lines, drawable, role, frame, edge);
  }
};

const append = (
  lines: IAutoMovieDrawingLine[],
  drawable: IDrawable,
  role: AutoMovieDrawingRole,
  frame: IAutoMovieDrawingFrame,
  edge: IAutoMovieDrawingEdge,
): void => {
  const from = round(projectAutoMovieDrawingPoint(frame, edge.from));
  const to = round(projectAutoMovieDrawingPoint(frame, edge.to));
  if (from.x === to.x && from.y === to.y) return;
  const forward = comparePoints(from, to) <= 0;
  lines.push({
    owner: drawable.id,
    space: drawable.space,
    layer: drawable.kind,
    role,
    from: forward ? from : to,
    to: forward ? to : from,
  });
};

const round = (point: IAutoMovieDrawingPoint): IAutoMovieDrawingPoint => ({
  x: roundAutoMovieDrawingScalar(point.x),
  y: roundAutoMovieDrawingScalar(point.y),
});

const roundFrame = (frame: IAutoMovieDrawingFrame): IAutoMovieDrawingFrame => ({
  origin: roundVector(frame.origin),
  right: roundVector(frame.right),
  up: roundVector(frame.up),
  normal: roundVector(frame.normal),
});

const roundVector = (vector: IAutoMovieVector3): IAutoMovieVector3 => ({
  x: roundAutoMovieDrawingScalar(vector.x),
  y: roundAutoMovieDrawingScalar(vector.y),
  z: roundAutoMovieDrawingScalar(vector.z),
});

const comparePoints = (
  left: IAutoMovieDrawingPoint,
  right: IAutoMovieDrawingPoint,
): number => left.x - right.x || left.y - right.y;

const lineKey = (line: IAutoMovieDrawingLine): string =>
  [
    line.role,
    line.layer,
    line.owner,
    line.from.x,
    line.from.y,
    line.to.x,
    line.to.y,
  ].join("|");

const compareLines = (
  left: IAutoMovieDrawingLine,
  right: IAutoMovieDrawingLine,
): number =>
  ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role) ||
  compareAutoMovieRenderIds(left.layer, right.layer) ||
  compareAutoMovieRenderIds(left.owner, right.owner) ||
  comparePoints(left.from, right.from) ||
  comparePoints(left.to, right.to);

/**
 * The page box that holds everything the sheet puts on paper.
 *
 * Dimensions and notes count, and they are why this is not simply the box
 * around the linework. A dimension string is drawn beside the plan rather than
 * across it and a note is led out past the wall it describes, so a box taken
 * from the geometry alone is a sheet whose own annotation hangs off the edge of
 * it — and the serializer sizes the page from this box, so what falls outside
 * is not merely close to the border, it is outside the viewBox and gone.
 *
 * A note contributes the point its text is set from and not the run of glyphs
 * that text becomes, which is the whole of what the derivation can know without
 * font metrics; the drawing declares that reach as a gap rather than letting
 * the box imply it measured the lettering. A stale target contributes nothing,
 * because it has no place on the page to be at.
 */
const extentOf = (
  lines: readonly IAutoMovieDrawingLine[],
  regions: readonly IAutoMovieDrawingRegion[],
  openings: readonly IAutoMovieDrawingOpeningMark[],
  dimensions: readonly IAutoMovieDrawingDimension[],
  annotations: readonly IAutoMovieDrawingAnnotation[],
): IAutoMovieDrawingExtent | null => {
  const points = [
    ...lines.flatMap((line) => [line.from, line.to]),
    ...regions.flatMap((region) => region.polygon),
    ...openings.flatMap((mark) => mark.polygon),
    ...dimensions.flatMap((dimension) =>
      dimension.status === "resolved" ? [dimension.from!, dimension.to!] : [],
    ),
    ...annotations.flatMap((annotation) =>
      annotation.status === "resolved" ? [annotation.at!] : [],
    ),
  ];
  if (points.length === 0) return null;
  const xs = autoMovieDrawingRange(points.map((point) => point.x));
  const ys = autoMovieDrawingRange(points.map((point) => point.y));
  return {
    min: { x: xs.min, y: ys.min },
    max: { x: xs.max, y: ys.max },
  };
};

const canonical = (drawing: Omit<IAutoMovieDrawing, "digest">): string =>
  [
    drawing.protocol,
    drawing.view,
    drawing.projection,
    drawing.discipline,
    String(drawing.scale),
    drawing.environment,
    [
      drawing.frame.origin,
      drawing.frame.right,
      drawing.frame.up,
      drawing.frame.normal,
    ]
      .map((vector) => `${vector.x},${vector.y},${vector.z}`)
      .join(";"),
    drawing.extent === null
      ? "none"
      : `${drawing.extent.min.x},${drawing.extent.min.y},${drawing.extent.max.x},${drawing.extent.max.y}`,
    ...drawing.lines.map((line) =>
      [
        line.role,
        line.layer,
        line.owner,
        String(line.space),
        line.from.x,
        line.from.y,
        line.to.x,
        line.to.y,
      ].join("|"),
    ),
    ...drawing.regions.map((region) =>
      [
        region.space,
        region.cell,
        region.kind,
        String(region.finish),
        String(region.area),
        region.polygon.map((point) => `${point.x},${point.y}`).join(";"),
      ].join("|"),
    ),
    ...drawing.openings.map((mark) =>
      [
        mark.opening,
        mark.boundary,
        mark.kind,
        String(mark.fill),
        mark.basis,
        String(mark.width),
        String(mark.height),
        mark.polygon.map((point) => `${point.x},${point.y}`).join(";"),
      ].join("|"),
    ),
    ...drawing.dimensions.map((dimension) =>
      [
        dimension.id,
        dimension.measure,
        dimension.status,
        String(dimension.value),
        String(dimension.reason),
      ].join("|"),
    ),
    ...drawing.annotations.map((annotation) =>
      [
        annotation.id,
        annotation.text,
        annotation.status,
        annotation.at === null
          ? "none"
          : `${annotation.at.x},${annotation.at.y}`,
        String(annotation.reason),
      ].join("|"),
    ),
    ...drawing.gaps.map((gap) =>
      [gap.subject, gap.status, gap.reason, gap.remedy].join("|"),
    ),
  ].join("\n");
