import {
  AutoMovieDrawingProjection,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawingFrame,
  IAutoMovieDrawingPoint,
  IAutoMovieDrawingView,
  IAutoMovieHalfSpacePlane,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieVector3,
} from "@automovie/interface";

import { tessellate } from "../geometry/tessellate";
import { Matrix4 } from "../math/Matrix4";
import { Vector3 } from "../math/Vector3";
import { convexHull2D } from "../math/hull";

/**
 * Decimal places every page coordinate, area and length is rounded to.
 *
 * A drawing is evidence, and evidence that differs in its sixteenth decimal
 * between two runs is not comparable by digest. Six places is a micrometre at
 * building scale: finer than any construction tolerance and coarse enough that
 * the last bits of an accumulated dot product cannot move it.
 */
export const AUTOMOVIE_DRAWING_DECIMALS = 6;

/** Tolerance for deciding which side of the cut plane a vertex is on. */
export const AUTOMOVIE_DRAWING_EPSILON = 1e-9;

/**
 * Half-extent of the square a logical cell's cross-section is clipped out of,
 * in metres.
 *
 * A convex cell is an intersection of half-spaces, and nothing in the design
 * forces that intersection to be bounded. Clipping starts from a square this
 * large and reports an unbounded result rather than printing a ten-kilometre
 * room as if somebody had drawn it.
 */
export const AUTOMOVIE_DRAWING_CELL_BOUND = 1e4;

/** One world-space triangle of some element's geometry. */
export interface IAutoMovieDrawingTriangle {
  /** First corner. */
  a: IAutoMovieVector3;
  /** Second corner. */
  b: IAutoMovieVector3;
  /** Third corner. */
  c: IAutoMovieVector3;
}

/** A straight world-space segment awaiting projection. */
export interface IAutoMovieDrawingEdge {
  /** Segment start. */
  from: IAutoMovieVector3;
  /** Segment end. */
  to: IAutoMovieVector3;
}

/**
 * Round one drawing scalar onto the fixed output grid.
 *
 * Negative zero is normalized away: `-0` and `0` are different strings, and a
 * digest over stringified coordinates would disagree with itself depending on
 * which side of an axis a wall happened to be built.
 */
export const roundAutoMovieDrawingScalar = (value: number): number => {
  const factor = 10 ** AUTOMOVIE_DRAWING_DECIMALS;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
};

/**
 * The lowest and highest of a run of numbers, folded rather than spread.
 *
 * `Math.min(...values)` passes one argument per element, and a mesh of
 * forty-odd thousand triangles — an ordinary imported one, and one the built
 * environment validator accepts without complaint — overflows the call stack
 * before a single line has been classified. A drawing kernel that worked only
 * on models small enough to fit in an argument list is a kernel nobody could
 * put a building through, so every extreme this folder takes is taken here.
 *
 * An empty run yields the identities, `+Infinity` and `-Infinity`. Every caller
 * has already established that it has something to measure; the identities are
 * what makes that precondition visible rather than a thrown `undefined`.
 *
 * @author Samchon
 */
export const autoMovieDrawingRange = (
  values: Iterable<number>,
): { min: number; max: number } => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
};

/**
 * Whether a projection removes material and draws what the plane passes
 * through.
 */
export const autoMovieDrawingHasCut = (
  projection: AutoMovieDrawingProjection,
): boolean => projection !== "elevation";

/**
 * Resolve one view's orthonormal page basis.
 *
 * The rule is one rule for every projection: the plane normal points back at
 * the viewer, the page right axis is `up x normal`, and the page up axis is
 * re-orthogonalized as `normal x right` so an author may write a nearby
 * cardinal direction instead of an exact in-plane vector.
 *
 * A reflected ceiling plan then negates the page right axis, and that single
 * negation is the whole of the reflection: with it, a coffer at a world point
 * lands on the same page point in the ceiling plan as the column under it does
 * in the floor plan, so the two sheets can be laid over one another. Without
 * it, looking up would mirror the building and every reader would have to undo
 * the mirror in their head.
 *
 * A degenerate view — zero direction, zero up, or an up parallel to the
 * direction — throws rather than silently producing a basis that is not a
 * basis.
 *
 * @author Samchon
 */
export const autoMovieDrawingFrame = (
  view: IAutoMovieDrawingView,
): IAutoMovieDrawingFrame => {
  requireFiniteVector(view.direction, `drawing view "${view.id}" direction`);
  requireFiniteVector(view.up, `drawing view "${view.id}" up`);
  if (Vector3.length(view.direction) <= AUTOMOVIE_DRAWING_EPSILON)
    throw new Error(`drawing view "${view.id}" direction must be non-zero`);
  if (Vector3.length(view.up) <= AUTOMOVIE_DRAWING_EPSILON)
    throw new Error(`drawing view "${view.id}" up must be non-zero`);
  requireFiniteVector(view.origin, `drawing view "${view.id}" origin`);
  if (!Number.isFinite(view.scale) || view.scale <= 0)
    throw new Error(
      `drawing view "${view.id}" scale must be a finite number > 0, but was ${view.scale}`,
    );
  requireOptionalDepth(view.depth, `drawing view "${view.id}" depth`);
  requireOptionalDepth(view.overhead, `drawing view "${view.id}" overhead`);

  const normal = Vector3.normalize(Vector3.scale(view.direction, -1));
  const raw = Vector3.cross(view.up, normal);
  if (Vector3.length(raw) <= AUTOMOVIE_DRAWING_EPSILON)
    throw new Error(
      `drawing view "${view.id}" up must not be parallel to its direction`,
    );
  const right = Vector3.normalize(raw);
  const up = Vector3.cross(normal, right);
  return {
    origin: view.origin,
    right:
      view.projection === "reflected-ceiling-plan"
        ? Vector3.scale(right, -1)
        : right,
    up,
    normal,
  };
};

/** Project one world point onto the page, without rounding. */
export const projectAutoMovieDrawingPoint = (
  frame: IAutoMovieDrawingFrame,
  point: IAutoMovieVector3,
): IAutoMovieDrawingPoint => {
  const local = Vector3.subtract(point, frame.origin);
  return {
    x: Vector3.dot(local, frame.right),
    y: Vector3.dot(local, frame.up),
  };
};

/** Signed distance from the cut plane; positive is the viewer's side. */
export const autoMovieDrawingPlaneDistance = (
  frame: IAutoMovieDrawingFrame,
  point: IAutoMovieVector3,
): number => Vector3.dot(Vector3.subtract(point, frame.origin), frame.normal);

/**
 * World transform of every element, parent composed into child.
 *
 * The same composition `lowerBuiltEnvironment` performs when it flattens the
 * hierarchy into staged scene nodes, so a line on the drawing and the set piece
 * it depicts stand in the same place. The suite pins that agreement directly
 * rather than trusting the two to stay in step.
 */
export const autoMovieDrawingWorldMatrices = (
  environment: IAutoMovieBuiltEnvironment,
): Map<string, number[]> => {
  const byId = new Map(
    environment.elements.map((element) => [element.id, element]),
  );
  const matrices = new Map<string, number[]>();
  const read = (id: string): number[] => {
    const cached = matrices.get(id);
    if (cached !== undefined) return cached;
    const element = byId.get(id)!;
    const local = Matrix4.compose(
      element.transform.translation,
      element.transform.rotation,
      element.transform.scale,
    );
    const world =
      element.parent === null
        ? local
        : Matrix4.multiply(read(element.parent), local);
    matrices.set(id, world);
    return world;
  };
  for (const element of environment.elements) read(element.id);
  return matrices;
};

/** Apply a column-major 4x4 matrix to a point. */
export const transformAutoMovieDrawingPoint = (
  matrix: readonly number[],
  point: IAutoMovieVector3,
): IAutoMovieVector3 => ({
  x:
    matrix[0]! * point.x +
    matrix[4]! * point.y +
    matrix[8]! * point.z +
    matrix[12]!,
  y:
    matrix[1]! * point.x +
    matrix[5]! * point.y +
    matrix[9]! * point.z +
    matrix[13]!,
  z:
    matrix[2]! * point.x +
    matrix[6]! * point.y +
    matrix[10]! * point.z +
    matrix[14]!,
});

/**
 * Triangles of one model part, in the part's own frame.
 *
 * A primitive is tessellated by the engine's own kernel, so the drawing and the
 * renderer read one description of a box. An imported mesh is taken as written.
 * Malformed arrays throw: a triangle list that is not a multiple of three is an
 * authoring defect, and drawing whatever prefix happens to divide evenly would
 * hide it behind a plausible-looking outline.
 */
export const autoMovieDrawingPartTriangles = (
  model: IAutoMovieModel,
  part: IAutoMovieModelPart,
): IAutoMovieDrawingTriangle[] => {
  const source =
    part.geometry.type === "primitive"
      ? tessellate(part.geometry.shape)
      : part.geometry.mesh;
  const positions = source.positions;
  const indices =
    source.indices ??
    Array.from({ length: positions.length / 3 }, (_, index) => index);
  if (positions.length % 3 !== 0)
    throw new Error(
      `model "${model.id}" part "${part.id}" has ${positions.length} position scalars, which is not a multiple of 3`,
    );
  if (indices.length % 3 !== 0)
    throw new Error(
      `model "${model.id}" part "${part.id}" has ${indices.length} indices, which is not a multiple of 3`,
    );
  const vertexCount = positions.length / 3;
  const corner = (index: number): IAutoMovieVector3 => {
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount)
      throw new Error(
        `model "${model.id}" part "${part.id}" index ${index} is outside its ${vertexCount} vertices`,
      );
    return {
      x: positions[index * 3]!,
      y: positions[index * 3 + 1]!,
      z: positions[index * 3 + 2]!,
    };
  };
  const local = part.transform;
  const matrix =
    local === null
      ? null
      : Matrix4.compose(local.translation, local.rotation, local.scale);
  const place = (point: IAutoMovieVector3): IAutoMovieVector3 =>
    matrix === null ? point : transformAutoMovieDrawingPoint(matrix, point);
  const triangles: IAutoMovieDrawingTriangle[] = [];
  for (let index = 0; index + 2 < indices.length; index += 3)
    triangles.push({
      a: place(corner(indices[index]!)),
      b: place(corner(indices[index + 1]!)),
      c: place(corner(indices[index + 2]!)),
    });
  return triangles;
};

/** Move every triangle of a list into world space. */
export const transformAutoMovieDrawingTriangles = (
  matrix: readonly number[],
  triangles: readonly IAutoMovieDrawingTriangle[],
): IAutoMovieDrawingTriangle[] =>
  triangles.map((triangle) => ({
    a: transformAutoMovieDrawingPoint(matrix, triangle.a),
    b: transformAutoMovieDrawingPoint(matrix, triangle.b),
    c: transformAutoMovieDrawingPoint(matrix, triangle.c),
  }));

/**
 * Where the cut plane passes through a triangle soup.
 *
 * One segment per straddling triangle. A triangle that lies exactly in the
 * plane contributes nothing: a face tangent to the cut is a tangency, not a
 * section, and emitting its three edges would scribble every interior diagonal
 * of a slab whose top happened to sit at the cut height.
 */
export const autoMovieDrawingCutEdges = (
  frame: IAutoMovieDrawingFrame,
  triangles: readonly IAutoMovieDrawingTriangle[],
): IAutoMovieDrawingEdge[] => {
  const edges: IAutoMovieDrawingEdge[] = [];
  for (const triangle of triangles) {
    const corners = [triangle.a, triangle.b, triangle.c];
    const distances = corners.map((corner) =>
      autoMovieDrawingPlaneDistance(frame, corner),
    );
    const above = distances.some((value) => value > AUTOMOVIE_DRAWING_EPSILON);
    const below = distances.some((value) => value < -AUTOMOVIE_DRAWING_EPSILON);
    if (!above || !below) continue;
    const hits: IAutoMovieVector3[] = [];
    for (let index = 0; index < 3; ++index) {
      const next = (index + 1) % 3;
      const da = distances[index]!;
      const db = distances[next]!;
      if (Math.abs(da) <= AUTOMOVIE_DRAWING_EPSILON) {
        hits.push(corners[index]!);
        continue;
      }
      if (da * db < 0)
        hits.push(
          Vector3.lerp(corners[index]!, corners[next]!, da / (da - db)),
        );
    }
    // A triangle with a vertex strictly on each side of the plane always yields
    // exactly two crossing points: either two edges cross it, or one edge does
    // and the third vertex sits on it. There is no one-point case to guard.
    edges.push({ from: hits[0]!, to: hits[1]! });
  }
  return edges;
};

/**
 * Keep only the part of a triangle soup on the far side of the cut plane.
 *
 * Sutherland-Hodgman on each triangle, re-fanned into triangles. The new faces
 * lying in the plane are exactly the ones the cut linework already draws, and
 * the caller drops their silhouette so no segment is drafted twice.
 */
export const clipAutoMovieDrawingTriangles = (
  frame: IAutoMovieDrawingFrame,
  triangles: readonly IAutoMovieDrawingTriangle[],
): IAutoMovieDrawingTriangle[] => {
  const kept: IAutoMovieDrawingTriangle[] = [];
  for (const triangle of triangles) {
    const polygon: IAutoMovieVector3[] = [];
    const corners = [triangle.a, triangle.b, triangle.c];
    for (let index = 0; index < 3; ++index) {
      const current = corners[index]!;
      const next = corners[(index + 1) % 3]!;
      const da = autoMovieDrawingPlaneDistance(frame, current);
      const db = autoMovieDrawingPlaneDistance(frame, next);
      if (da <= AUTOMOVIE_DRAWING_EPSILON) polygon.push(current);
      if (da * db < 0)
        polygon.push(Vector3.lerp(current, next, da / (da - db)));
    }
    for (let index = 1; index + 1 < polygon.length; ++index)
      kept.push({
        a: polygon[0]!,
        b: polygon[index]!,
        c: polygon[index + 1]!,
      });
  }
  return kept;
};

/**
 * Silhouette of a triangle soup under the view's orthographic direction.
 *
 * An edge is drawn when the faces meeting along it disagree about facing the
 * viewer, or when only one face owns it. Faces exactly edge-on count as facing
 * away, which is what makes a plan of an upright box its four top edges rather
 * than nothing at all: the top faces the viewer, the four walls are edge-on and
 * so count as away, and the disagreement along each top edge is the outline.
 *
 * Vertices are welded on the rounded output grid before edges are keyed, so two
 * triangles that meet at a shared corner are recognised as meeting there even
 * when the arithmetic that produced the corner differed by a last bit.
 */
export const autoMovieDrawingSilhouetteEdges = (
  frame: IAutoMovieDrawingFrame,
  triangles: readonly IAutoMovieDrawingTriangle[],
): IAutoMovieDrawingEdge[] => {
  const key = (point: IAutoMovieVector3): string =>
    `${roundAutoMovieDrawingScalar(point.x)},${roundAutoMovieDrawingScalar(point.y)},${roundAutoMovieDrawingScalar(point.z)}`;
  const owners = new Map<
    string,
    { edge: IAutoMovieDrawingEdge; front: number; back: number }
  >();
  for (const triangle of triangles) {
    const normal = Vector3.cross(
      Vector3.subtract(triangle.b, triangle.a),
      Vector3.subtract(triangle.c, triangle.a),
    );
    if (Vector3.length(normal) <= AUTOMOVIE_DRAWING_EPSILON) continue;
    const front = Vector3.dot(normal, frame.normal) > 0;
    const corners = [triangle.a, triangle.b, triangle.c];
    for (let index = 0; index < 3; ++index) {
      const from = corners[index]!;
      const to = corners[(index + 1) % 3]!;
      const left = key(from);
      const right = key(to);
      if (left === right) continue;
      const id = left < right ? `${left}|${right}` : `${right}|${left}`;
      const current = owners.get(id) ?? {
        edge: { from, to },
        front: 0,
        back: 0,
      };
      if (front) ++current.front;
      else ++current.back;
      owners.set(id, current);
    }
  }
  const edges: IAutoMovieDrawingEdge[] = [];
  for (const entry of owners.values())
    if (entry.front + entry.back === 1 || (entry.front > 0 && entry.back > 0))
      edges.push(entry.edge);
  return edges;
};

/**
 * Cross-section of one convex cell on the cut plane, as a page polygon.
 *
 * Each world half-space becomes a half-plane in page coordinates, and the
 * cross-section is what survives clipping a large square by all of them. The
 * square is what makes an unbounded cell detectable: a result that still
 * touches it was never bounded by the design, and the caller says so instead of
 * printing the square as a room.
 */
export const autoMovieDrawingCellSection = (
  frame: IAutoMovieDrawingFrame,
  planes: readonly IAutoMovieHalfSpacePlane[],
): { polygon: IAutoMovieDrawingPoint[]; bounded: boolean } => {
  const bound = AUTOMOVIE_DRAWING_CELL_BOUND;
  let polygon: IAutoMovieDrawingPoint[] = [
    { x: -bound, y: -bound },
    { x: bound, y: -bound },
    { x: bound, y: bound },
    { x: -bound, y: bound },
  ];
  for (const plane of planes) {
    const a = Vector3.dot(plane.normal, frame.right);
    const b = Vector3.dot(plane.normal, frame.up);
    const c = plane.offset - Vector3.dot(plane.normal, frame.origin);
    if (
      Math.abs(a) <= AUTOMOVIE_DRAWING_EPSILON &&
      Math.abs(b) <= AUTOMOVIE_DRAWING_EPSILON
    ) {
      // The plane is parallel to the page: it either contains the whole
      // cross-section or removes all of it, and there is no line to clip on.
      if (c < -AUTOMOVIE_DRAWING_EPSILON) return { polygon: [], bounded: true };
      continue;
    }
    polygon = clipHalfPlane(polygon, a, b, c);
    if (polygon.length === 0) return { polygon: [], bounded: true };
  }
  const bounded = polygon.every(
    (point) =>
      Math.abs(point.x) < bound - AUTOMOVIE_DRAWING_EPSILON &&
      Math.abs(point.y) < bound - AUTOMOVIE_DRAWING_EPSILON,
  );
  return { polygon, bounded };
};

/** Signed doubled-area shoelace magnitude, halved: the area of a simple polygon. */
export const autoMovieDrawingPolygonArea = (
  polygon: readonly IAutoMovieDrawingPoint[],
): number => {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < polygon.length; ++index) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
};

/**
 * Volume of one bounded convex cell, from its own half-spaces.
 *
 * Every triple of planes is solved for its corner, corners outside any other
 * half-space are discarded, and the survivors are the cell's vertices. Each
 * face is then the hull of the vertices lying on one plane, and the volume is
 * the sum of the cones from the cell's interior point to those faces. An
 * unbounded or degenerate cell has no such vertex set and reports `null` rather
 * than a number nobody can act on.
 */
export const autoMovieDrawingCellVolume = (
  planes: readonly IAutoMovieHalfSpacePlane[],
): number | null => {
  // Normalized so a plane's offset is a true distance: the design deliberately
  // does not require a unit normal, and a cone height taken against an
  // unnormalized one would scale the volume by whatever length the author wrote.
  //
  // Deduplicated for a sharper reason. The volume below is the sum of the cones
  // standing on the solid's faces, so a plane written twice — or written once
  // long and once short — would stand a second cone on a face that exists once
  // and inflate the solid by that whole face. A repeated half-space bounds
  // nothing new, and it must measure nothing new.
  const scaled = [
    ...new Map(
      planes.map((plane) => {
        const normal = Vector3.normalize(plane.normal);
        const offset = plane.offset / Vector3.length(plane.normal);
        return [
          [normal.x, normal.y, normal.z, offset]
            .map(roundAutoMovieDrawingScalar)
            .join(","),
          { normal, offset },
        ] as const;
      }),
    ).values(),
  ];
  const vertices: IAutoMovieVector3[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < scaled.length; ++i)
    for (let j = i + 1; j < scaled.length; ++j)
      for (let k = j + 1; k < scaled.length; ++k) {
        const corner = intersectPlanes(scaled[i]!, scaled[j]!, scaled[k]!);
        if (corner === null) continue;
        if (
          scaled.some(
            (plane) => Vector3.dot(plane.normal, corner) - plane.offset > 1e-6,
          )
        )
          continue;
        const id = `${roundAutoMovieDrawingScalar(corner.x)},${roundAutoMovieDrawingScalar(corner.y)},${roundAutoMovieDrawingScalar(corner.z)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        vertices.push(corner);
      }
  if (vertices.length < 4) return null;
  const interior = vertices.reduce(
    (sum, vertex) => Vector3.add(sum, vertex),
    Vector3.create(),
  );
  const center = Vector3.scale(interior, 1 / vertices.length);
  let volume = 0;
  // The vector area of a closed surface is zero: every face's outward normal is
  // cancelled by the rest of the boundary. An unbounded cell has faces where it
  // was cut and none where it runs off, so its vector area cannot cancel — and
  // that is the only cheap way to catch the unbounded cells a vertex count
  // cannot. A column bounded on four sides and open at the top has four corners
  // and would otherwise report a confident zero; a wedge with two capping
  // planes has six and would report a confident wrong number.
  let closure = Vector3.create();
  let facing = 0;
  for (const plane of scaled) {
    const onFace = vertices.filter(
      (vertex) =>
        Math.abs(Vector3.dot(plane.normal, vertex) - plane.offset) <= 1e-6,
    );
    const basis = faceBasis(plane.normal);
    const flattened = onFace.map((vertex) => ({
      x: Vector3.dot(vertex, basis.right),
      y: 0,
      z: Vector3.dot(vertex, basis.up),
    }));
    // A redundant plane touching the solid at one vertex or along one edge
    // bounds no face, and neither does a plane whose vertices are collinear;
    // the hull collapses in both cases and the cone contributes nothing.
    const hull = convexHull2D(flattened);
    if (hull.length < 3) continue;
    let doubled = 0;
    for (let index = 0; index < hull.length; ++index) {
      const current = hull[index]!;
      const next = hull[(index + 1) % hull.length]!;
      doubled += current.x * next.z - next.x * current.z;
    }
    const area = Math.abs(doubled) / 2;
    const height = Math.abs(Vector3.dot(plane.normal, center) - plane.offset);
    volume += (area * height) / 3;
    closure = Vector3.add(closure, Vector3.scale(plane.normal, area));
    facing += area;
  }
  if (Vector3.length(closure) > facing * 1e-6) return null;
  return volume;
};

const faceBasis = (
  normal: IAutoMovieVector3,
): { right: IAutoMovieVector3; up: IAutoMovieVector3 } => {
  const seed =
    Math.abs(normal.x) < 0.9
      ? Vector3.create(1, 0, 0)
      : Vector3.create(0, 1, 0);
  const right = Vector3.normalize(Vector3.cross(seed, normal));
  return { right, up: Vector3.cross(normal, right) };
};

const intersectPlanes = (
  first: { normal: IAutoMovieVector3; offset: number },
  second: { normal: IAutoMovieVector3; offset: number },
  third: { normal: IAutoMovieVector3; offset: number },
): IAutoMovieVector3 | null => {
  const cross23 = Vector3.cross(second.normal, third.normal);
  const determinant = Vector3.dot(first.normal, cross23);
  if (Math.abs(determinant) <= 1e-9) return null;
  const cross31 = Vector3.cross(third.normal, first.normal);
  const cross12 = Vector3.cross(first.normal, second.normal);
  return Vector3.scale(
    Vector3.add(
      Vector3.add(
        Vector3.scale(cross23, first.offset),
        Vector3.scale(cross31, second.offset),
      ),
      Vector3.scale(cross12, third.offset),
    ),
    1 / determinant,
  );
};

const clipHalfPlane = (
  polygon: readonly IAutoMovieDrawingPoint[],
  a: number,
  b: number,
  c: number,
): IAutoMovieDrawingPoint[] => {
  const out: IAutoMovieDrawingPoint[] = [];
  for (let index = 0; index < polygon.length; ++index) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const dCurrent = a * current.x + b * current.y - c;
    const dNext = a * next.x + b * next.y - c;
    if (dCurrent <= 0) out.push(current);
    if (dCurrent * dNext < 0) {
      const t = dCurrent / (dCurrent - dNext);
      out.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      });
    }
  }
  return out;
};

const requireFiniteVector = (value: IAutoMovieVector3, label: string): void => {
  if (
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  )
    throw new Error(`${label} must be finite on every axis`);
};

const requireOptionalDepth = (value: number | null, label: string): void => {
  if (value !== null && (!Number.isFinite(value) || value < 0))
    throw new Error(
      `${label} must be null or a finite number at or above zero, but was ${value}`,
    );
};
