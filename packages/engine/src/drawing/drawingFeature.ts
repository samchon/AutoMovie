import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawingFeature,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import {
  IAutoMovieDrawingTriangle,
  autoMovieDrawingPartTriangles,
  autoMovieDrawingWorldMatrices,
  roundAutoMovieDrawingScalar,
  transformAutoMovieDrawingPoint,
  transformAutoMovieDrawingTriangles,
} from "./drawingProjection";

/**
 * What resolving one annotation target against the current design produced.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Carries the exact anchor, orientation, feature count, and stale explanation that keeps a drawing annotation traceable to current geometry.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Defines the complete resolved-or-stale result of looking up one authored drawing feature in the built environment.
 */
export interface IAutoMovieDrawingFeatureResolution {
  /**
   * Whether the target still addresses a feature of the design.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Marks whether the annotation target still names a real feature or must be shown as stale.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Distinguishes a successful current-geometry lookup from an invalidated feature reference.
   */
  status: "resolved" | "stale";
  /**
   * World position of the feature, or `null` when stale.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Supplies the current world-space anchor from which the drawing places the resolved note or dimension.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Holds the transformed feature coordinate on success and `null` for a stale reference.
   */
  point: IAutoMovieVector3 | null;
  /**
   * Unit world direction the feature carries, or `null`.
   *
   * An edge and an axis have one; a vertex, a face centre and a centroid do
   * not, and inventing an arbitrary direction for them would make a leader line
   * point somewhere the design never said.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Supplies the normalized world direction used to orient an axis- or edge-based annotation.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Preserves a directional feature's transformed orientation while leaving nondirectional features explicitly directionless.
   */
  direction: IAutoMovieVector3 | null;
  /**
   * How many features of this kind the design currently has.
   *
   * Populated even when the target is stale because the count changed, since
   * that number is exactly what the author has to write to re-pin the note.
   * Zero when the element, part or model could not be reached at all.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Reports the current number of selectable features so a stale indexed annotation can be repaired against the revised model.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Retains the actual feature cardinality even when the authored expected count or index no longer matches.
   */
  count: number;
  /**
   * Exactly why the target no longer resolves, or `null` when resolved.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views States why a pinned annotation no longer resolves instead of silently omitting or relocating it.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Carries the precise lookup, topology, or count failure for a stale target and `null` after successful resolution.
   */
  reason: string | null;
}

/**
 * Resolve one pinned feature against the design as it stands now.
 *
 * This is the whole of what keeps a note honest. The target stores where a
 * feature was, not what it measured, so moving a wall moves its dimension and
 * changes its number; and the target stores how many features of that kind
 * existed, so replacing a wall with a differently shaped one is reported stale
 * instead of relocating the note onto whichever feature inherited the index.
 *
 * The two outcomes are the only two: a feature this function cannot find is
 * never approximated to the nearest surviving one.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Re-resolves a pinned drawing feature against current geometry so its annotation follows valid edits and exposes invalid ones.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Verifies the authored feature identity and cardinality, transforms the exact match to world space, and returns stale rather than approximating a replacement.
 * @author Samchon
 */
export const resolveAutoMovieDrawingFeature = (
  environment: IAutoMovieBuiltEnvironment,
  feature: IAutoMovieDrawingFeature,
  matrices?: ReadonlyMap<string, number[]>,
): IAutoMovieDrawingFeatureResolution => {
  const element = environment.elements.find(
    (candidate) => candidate.id === feature.element,
  );
  if (element === undefined)
    return stale(
      `built environment "${environment.id}" has no element "${feature.element}"`,
    );
  const matrix = (matrices ?? autoMovieDrawingWorldMatrices(environment)).get(
    element.id,
  )!;

  if (feature.kind === "axis") {
    // Integral on purpose: a fractional index names no axis, and without this
    // it would select none of the three, produce a zero direction, and be
    // reported as a wall flattened by its own scale — a true message about the
    // wrong thing, which is worse than no message.
    if (
      !Number.isInteger(feature.index) ||
      feature.index < 0 ||
      feature.index > 2
    )
      return stale(
        `element "${element.id}" axis index must be 0, 1 or 2, but was ${feature.index}`,
      );
    if (feature.count !== null && feature.count !== 3)
      return stale(
        `element "${element.id}" has 3 axes, but the target was authored against ${feature.count}`,
        3,
      );
    const origin = transformAutoMovieDrawingPoint(matrix, Vector3.create());
    const tip = transformAutoMovieDrawingPoint(
      matrix,
      Vector3.create(
        feature.index === 0 ? 1 : 0,
        feature.index === 1 ? 1 : 0,
        feature.index === 2 ? 1 : 0,
      ),
    );
    const direction = Vector3.subtract(tip, origin);
    if (Vector3.length(direction) === 0)
      return stale(
        `element "${element.id}" axis ${feature.index} is collapsed by its own scale, so it has no direction`,
      );
    return {
      status: "resolved",
      point: origin,
      direction: Vector3.normalize(direction),
      count: 3,
      reason: null,
    };
  }

  if (element.model === null)
    return stale(
      `element "${element.id}" has no model, so it carries no "${feature.kind}" feature`,
    );
  const model = environment.models.find(
    (candidate) => candidate.id === element.model,
  );
  if (model === undefined)
    return stale(
      `element "${element.id}" cites runtime model "${element.model}", whose geometry this design does not carry`,
    );
  const parts =
    feature.part === null
      ? model.parts
      : model.parts.filter((part) => part.id === feature.part);
  if (parts.length === 0)
    return stale(`model "${model.id}" has no part "${String(feature.part)}"`);
  const triangles = transformAutoMovieDrawingTriangles(
    matrix,
    parts.flatMap((part) => autoMovieDrawingPartTriangles(model, part)),
  );

  if (feature.kind === "centroid") {
    if (feature.index !== 0)
      return stale(
        `element "${element.id}" centroid index must be 0, but was ${feature.index}`,
      );
    if (feature.count !== null && feature.count !== 1)
      return stale(
        `element "${element.id}" has 1 centroid, but the target was authored against ${feature.count}`,
        1,
      );
    const vertices = canonicalVertices(triangles);
    if (vertices.length === 0)
      return stale(
        `element "${element.id}" has no geometry, so it has no centroid`,
      );
    return {
      status: "resolved",
      point: Vector3.scale(
        vertices.reduce(
          (sum, vertex) => Vector3.add(sum, vertex),
          Vector3.create(),
        ),
        1 / vertices.length,
      ),
      direction: null,
      count: 1,
      reason: null,
    };
  }

  if (feature.kind === "vertex") {
    const vertices = canonicalVertices(triangles);
    const guard = check(feature, vertices.length, element.id, "vertex");
    if (guard !== null) return guard;
    return {
      status: "resolved",
      point: vertices[feature.index]!,
      direction: null,
      count: vertices.length,
      reason: null,
    };
  }

  if (feature.kind === "edge") {
    const edges = canonicalEdges(triangles);
    const guard = check(feature, edges.length, element.id, "edge");
    if (guard !== null) return guard;
    const edge = edges[feature.index]!;
    const span = Vector3.subtract(edge.to, edge.from);
    return {
      status: "resolved",
      point: Vector3.scale(Vector3.add(edge.from, edge.to), 0.5),
      direction: Vector3.normalize(span),
      count: edges.length,
      reason: null,
    };
  }

  const guard = check(feature, triangles.length, element.id, "face");
  if (guard !== null) return guard;
  const face = triangles[feature.index]!;
  return {
    status: "resolved",
    point: Vector3.scale(
      Vector3.add(Vector3.add(face.a, face.b), face.c),
      1 / 3,
    ),
    direction: null,
    count: triangles.length,
    reason: null,
  };
};

/**
 * The element's world vertices, welded and in one canonical order.
 *
 * Sorted rather than left in emission order so the index a target stores means
 * the same corner after the model's parts are reordered, which is a change to
 * how the design is written and not to the building it describes.
 */
const canonicalVertices = (
  triangles: readonly IAutoMovieDrawingTriangle[],
): IAutoMovieVector3[] => {
  const unique = new Map<string, IAutoMovieVector3>();
  for (const triangle of triangles)
    for (const corner of [triangle.a, triangle.b, triangle.c])
      unique.set(vertexKey(corner), corner);
  return [...unique.values()].sort(comparePoints);
};

/** The element's welded undirected edges, in one canonical order. */
const canonicalEdges = (
  triangles: readonly IAutoMovieDrawingTriangle[],
): Array<{ from: IAutoMovieVector3; to: IAutoMovieVector3 }> => {
  const unique = new Map<
    string,
    { from: IAutoMovieVector3; to: IAutoMovieVector3 }
  >();
  for (const triangle of triangles) {
    const corners = [triangle.a, triangle.b, triangle.c];
    for (let index = 0; index < 3; ++index) {
      const from = corners[index]!;
      const to = corners[(index + 1) % 3]!;
      const forward = comparePoints(from, to);
      if (forward === 0) continue;
      const ordered = forward < 0 ? { from, to } : { from: to, to: from };
      unique.set(
        `${vertexKey(ordered.from)}|${vertexKey(ordered.to)}`,
        ordered,
      );
    }
  }
  return [...unique.values()].sort(
    (left, right) =>
      comparePoints(left.from, right.from) || comparePoints(left.to, right.to),
  );
};

/**
 * Order two world points by coordinate, not by their printed form.
 *
 * Numeric rather than textual because a text order puts `10` before `2`, and an
 * index a note is pinned to would then jump the moment a wall grew past ten
 * metres — a renumbering with no cause in the building.
 */
const comparePoints = (
  left: IAutoMovieVector3,
  right: IAutoMovieVector3,
): number =>
  roundAutoMovieDrawingScalar(left.x) - roundAutoMovieDrawingScalar(right.x) ||
  roundAutoMovieDrawingScalar(left.y) - roundAutoMovieDrawingScalar(right.y) ||
  roundAutoMovieDrawingScalar(left.z) - roundAutoMovieDrawingScalar(right.z);

const vertexKey = (point: IAutoMovieVector3): string =>
  `${roundAutoMovieDrawingScalar(point.x)},${roundAutoMovieDrawingScalar(point.y)},${roundAutoMovieDrawingScalar(point.z)}`;

const check = (
  feature: IAutoMovieDrawingFeature,
  count: number,
  element: string,
  label: string,
): IAutoMovieDrawingFeatureResolution | null => {
  if (feature.count !== null && feature.count !== count)
    return stale(
      `element "${element}" now has ${count} ${label} features, but the target was authored against ${feature.count}`,
      count,
    );
  if (
    !Number.isInteger(feature.index) ||
    feature.index < 0 ||
    feature.index >= count
  )
    return stale(
      `element "${element}" ${label} index ${feature.index} is outside its ${count} ${label} features`,
      count,
    );
  return null;
};

const stale = (
  reason: string,
  count = 0,
): IAutoMovieDrawingFeatureResolution => ({
  status: "stale",
  point: null,
  direction: null,
  count,
  reason,
});
