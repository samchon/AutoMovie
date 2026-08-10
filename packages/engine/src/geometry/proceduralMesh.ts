import {
  IAutoMovieMesh,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { convexHull2D } from "../math/hull";

/** One point of a code-authored 2D construction profile. */
export interface IAutoMovieProfilePoint {
  /** Horizontal profile coordinate in metres. */
  x: number;
  /** Vertical profile coordinate in metres. */
  y: number;
}

/** One axis-aligned rectangular void in a wall's local XY face. */
export interface IAutoMovieWallOpening {
  /** Stable opening identity used in diagnostics. */
  id: string;
  /** Left edge measured from the wall's left edge. */
  x: number;
  /** Bottom edge measured from the wall's bottom edge. */
  y: number;
  /** Positive opening width. */
  width: number;
  /** Positive opening height. */
  height: number;
}

/** A rigid translate / unit-quaternion rotate / per-axis scale placement. */
export interface IAutoMovieMeshTransform {
  /** Metres added after rotation and scale; omitted means the origin. */
  translation?: IAutoMovieVector3;
  /** Unit quaternion applied after scale; omitted means identity. */
  rotation?: IAutoMovieQuaternion;
  /** Per-axis scale applied first; omitted means unit scale. */
  scale?: IAutoMovieVector3;
}

/** One named member of an assembly, optionally placed by its own transform. */
export interface IAutoMovieMeshPart {
  /** Stable member identity, unique inside one assembly. */
  id: string;
  /** The member's geometry in its own local frame. */
  mesh: IAutoMovieMesh;
  /** Where the member sits in the assembly frame. */
  transform?: IAutoMovieMeshTransform;
}

/** The index range one assembly member occupies in the merged mesh. */
export interface IAutoMovieMeshGroup {
  /** The contributing {@link IAutoMovieMeshPart.id}. */
  id: string;
  /** First index of the member's triangles inside the merged index array. */
  start: number;
  /** How many indices the member contributes; always a multiple of three. */
  count: number;
}

/** One merged mesh plus the material groups its members occupy. */
export interface IAutoMovieMeshAssembly {
  /** The merged rigid mesh. */
  mesh: IAutoMovieMesh;
  /** Declaration-ordered index ranges, one per contributing member. */
  groups: IAutoMovieMeshGroup[];
}

/** What a mesh's triangle topology actually is, measured rather than assumed. */
export interface IAutoMovieMeshTopology {
  /** Triangle count, including degenerate ones. */
  triangles: number;
  /** Triangles whose welded corners are not three distinct points. */
  degenerate: number;
  /** Position, normal, or uv components that are not finite numbers. */
  nonFinite: number;
  /** Welded edges used by exactly one triangle: the open boundary. */
  boundaryEdges: number;
  /** Welded edges used by three or more triangles. */
  nonManifoldEdges: number;
  /** True when every welded edge is shared by exactly two triangles. */
  watertight: boolean;
  /** Divergence-theorem signed volume; exact for a closed polyhedron. */
  volume: number;
}

/** One closed ring's span inside a triangulation's shared point list. */
export interface IAutoMovieRegionRing {
  /** First index the ring owns in {@link IAutoMovieRegionTriangulation.points}. */
  start: number;
  /** How many points the ring owns. */
  count: number;
}

/** A free-form planar region resolved into counter-clockwise triangles. */
export interface IAutoMovieRegionTriangulation {
  /**
   * Every ring's points in one list, canonically wound: the outer ring
   * counter-clockwise first, then each hole clockwise in declared order.
   */
  points: IAutoMovieProfilePoint[];
  /** Where each ring sits in {@link points}; `rings[0]` is the outer ring. */
  rings: IAutoMovieRegionRing[];
  /** Corner indices into {@link points}, three per counter-clockwise triangle. */
  triangles: number[];
  /** Enclosed area in square metres: the outer ring less every hole. */
  area: number;
}

/** One station of a loft: where it sits along the path and what it looks like. */
export interface IAutoMovieLoftSection {
  /**
   * Where the section sits along the path, `0` at its first point and `1` at
   * its last, measured by chord length.
   */
  at: number;
  /** The enclosing ring, in the path frame's right / up axes, in metres. */
  outer: readonly IAutoMovieProfilePoint[];
  /** Rings removed from the section; omitted means a solid section. */
  holes?: ReadonlyArray<readonly IAutoMovieProfilePoint[]>;
}

/**
 * Extrude a convex XY profile along local Z into a closed triangle mesh.
 *
 * The result carries generated vertex normals and no UV atlas: where a prism's
 * seam falls is a finish decision this kernel does not make for the caller, and
 * {@link buildAutoMoviePolyhedron} is the builder that does lay one out, by
 * measuring each face's own plane in metres.
 */
export const extrudeAutoMovieProfile = (props: {
  profile: readonly IAutoMovieProfilePoint[];
  depth: number;
}): IAutoMovieMesh => {
  positive(props.depth, "extrusion depth");
  const profile = profileHull(props.profile);
  const half = props.depth / 2;
  const positions: number[] = [];
  for (const point of profile) positions.push(point.x, point.y, half);
  for (const point of profile) positions.push(point.x, point.y, -half);
  const count = profile.length;
  const indices: number[] = [];
  for (let index = 1; index + 1 < count; ++index) {
    indices.push(0, index, index + 1);
    indices.push(count, count + index + 1, count + index);
  }
  for (let index = 0; index < count; ++index) {
    const next = (index + 1) % count;
    indices.push(index, count + index, next);
    indices.push(next, count + index, count + next);
  }
  return meshOf(positions, indices);
};

/**
 * Revolve a radius/height profile around local Y into a closed surface.
 *
 * Unlike extrusion and sweep, the meridian is taken as authored rather than
 * hulled, so an arbitrary silhouette polyline is allowed here; only its radii
 * must be non-negative.
 *
 * Closure follows the meridian and is the caller's to declare: a meridian that
 * starts and ends on the axis closes into a solid whose pole rings collapse to
 * zero-area triangles, and one that does not is an open tube with a rim at each
 * end. Neither is repaired, and no UV atlas is generated.
 */
export const revolveAutoMovieProfile = (props: {
  profile: readonly IAutoMovieProfilePoint[];
  segments: number;
}): IAutoMovieMesh => {
  if (props.profile.length < 2)
    throw new Error("revolve profile needs at least two points");
  countAtLeast(props.segments, 3, "revolve segments");
  props.profile.forEach((point, index) => {
    finitePoint(point, `revolve profile[${index}]`);
    if (point.x < 0)
      throw new Error(`revolve profile[${index}] radius must be >= 0`);
  });
  const positions: number[] = [];
  for (let segment = 0; segment <= props.segments; ++segment) {
    const angle = (segment / props.segments) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (const point of props.profile)
      positions.push(point.x * cosine, point.y, point.x * sine);
  }
  const count = props.profile.length;
  const indices: number[] = [];
  for (let segment = 0; segment < props.segments; ++segment)
    for (let point = 0; point + 1 < count; ++point) {
      const current = segment * count + point;
      const next = current + count;
      indices.push(current, current + 1, next);
      indices.push(current + 1, next + 1, next);
    }
  return meshOf(positions, indices);
};

/**
 * Sweep a convex 2D profile along a 3D polyline using a stable local frame.
 *
 * This is the code path for moulding, rails, pipes, arches, and other members
 * whose section repeats along a path. Adjacent path points must be distinct.
 * Both ends are capped, so a sweep along a simple path is a closed solid; no UV
 * atlas is generated.
 */
export const sweepAutoMovieProfile = (props: {
  profile: readonly IAutoMovieProfilePoint[];
  path: readonly IAutoMovieVector3[];
}): IAutoMovieMesh => {
  const profile = profileHull(props.profile);
  if (props.path.length < 2)
    throw new Error("sweep path needs at least two points");
  props.path.forEach((point, index) =>
    finiteVector(point, `sweep path[${index}]`),
  );
  const positions: number[] = [];
  props.path.forEach((point, index) => {
    const tangent = tangentAt(props.path, index, "sweep path");
    const guide =
      Math.abs(tangent.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const right = Vector3.normalize(Vector3.cross(guide, tangent));
    const up = Vector3.normalize(Vector3.cross(tangent, right));
    for (const profilePoint of profile)
      positions.push(
        point.x + right.x * profilePoint.x + up.x * profilePoint.y,
        point.y + right.y * profilePoint.x + up.y * profilePoint.y,
        point.z + right.z * profilePoint.x + up.z * profilePoint.y,
      );
  });
  const count = profile.length;
  const indices: number[] = [];
  for (let ring = 0; ring + 1 < props.path.length; ++ring)
    for (let point = 0; point < count; ++point) {
      const nextPoint = (point + 1) % count;
      const current = ring * count + point;
      const nextRing = current + count;
      indices.push(current, nextPoint + ring * count, nextRing);
      indices.push(
        nextPoint + ring * count,
        nextRing + nextPoint - point,
        nextRing,
      );
    }
  for (let point = 1; point + 1 < count; ++point) {
    indices.push(0, point + 1, point);
    const last = (props.path.length - 1) * count;
    indices.push(last, last + point, last + point + 1);
  }
  return meshOf(positions, indices);
};

/**
 * Build a boundary representation from planar polygonal faces.
 *
 * Extrusion, revolution, and sweep each impose a shape on the result; this is
 * the general escape for a solid whose faces are simply stated, such as a
 * ridged roof, a wedge, or a chamfered pier, without dropping to authored
 * vertex arrays. Each face owns its corners, so its normal stays flat across
 * the seam and its UV frame is the face's own plane measured in metres.
 *
 * Faces are refused, never quietly repaired: fewer than three corners, a
 * non-finite corner, a collinear face carrying no area, a corner off the face's
 * own plane, and a reflex corner each raise their own diagnostic. Convexity is
 * demanded because the face is fanned from its first corner, and fanning a
 * concave outline emits triangles that cover ground the face does not. Whether
 * the result is a closed shell is the caller's declaration to make and
 * {@link inspectAutoMovieMeshTopology}'s to check.
 */
export const buildAutoMoviePolyhedron = (
  faces: ReadonlyArray<readonly IAutoMovieVector3[]>,
): IAutoMovieMesh => {
  if (faces.length === 0) throw new Error("polyhedron needs at least one face");
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  faces.forEach((corners, face) => {
    if (corners.length < 3)
      throw new Error(`polyhedron face[${face}] needs at least three corners`);
    corners.forEach((corner, index) =>
      finiteVector(corner, `polyhedron face[${face}] corner[${index}]`),
    );
    const origin = corners[0]!;
    const spans = Vector3.cross(
      Vector3.subtract(corners[1]!, origin),
      Vector3.subtract(corners[corners.length - 1]!, origin),
    );
    if (Vector3.length(spans) <= FACE_EPSILON)
      throw new Error(`polyhedron face[${face}] encloses no area`);
    const normal = Vector3.normalize(spans);
    if (
      corners.some(
        (corner) =>
          Math.abs(Vector3.dot(Vector3.subtract(corner, origin), normal)) >
          FACE_EPSILON,
      )
    )
      throw new Error(`polyhedron face[${face}] is not planar`);
    for (let index = 0; index < corners.length; ++index) {
      const previous = corners[(index + corners.length - 1) % corners.length]!;
      const current = corners[index]!;
      const next = corners[(index + 1) % corners.length]!;
      if (
        Vector3.dot(
          Vector3.cross(
            Vector3.subtract(current, previous),
            Vector3.subtract(next, current),
          ),
          normal,
        ) < -FACE_EPSILON
      )
        throw new Error(`polyhedron face[${face}] must be convex`);
    }
    const axisU = Vector3.normalize(Vector3.subtract(corners[1]!, origin));
    const axisV = Vector3.cross(normal, axisU);
    const base = positions.length / 3;
    for (const corner of corners) {
      const delta = Vector3.subtract(corner, origin);
      positions.push(corner.x, corner.y, corner.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(Vector3.dot(delta, axisU), Vector3.dot(delta, axisV));
    }
    for (let index = 1; index + 1 < corners.length; ++index)
      indices.push(base, base + index, base + index + 1);
  });
  return { positions, normals, uvs, indices, skin: null };
};

/**
 * Build a local XY wall around rectangular door/window openings.
 *
 * The wall is partitioned at every opening edge, the cells an opening covers
 * are dropped, and each surviving cell contributes only the faces no
 * neighbouring cell hides. Openings therefore remain real holes in beauty,
 * depth, normal, and mask passes instead of metadata painted over an uncut
 * wall, and the standing wall is one closed 2-manifold solid.
 *
 * Dropping the hidden faces is what earns that. A union of one box per cell
 * carries an interior face between every adjacent pair, so each shared edge
 * belongs to four triangles; `validateMeshTopology` reads that as non-manifold
 * and `validateModel` therefore refuses any model carrying the wall, leaving a
 * builder whose own output the rest of the engine cannot accept. Those interior
 * faces are also triangles no camera can reach, and a budget counts them.
 *
 * Every cell corner is a lattice coordinate minus one half-extent, so the face
 * two adjacent cells share is the same pair of doubles read from both sides,
 * bit for bit. Deriving a corner from the cell's own centre and half-width
 * instead would round it, and two edges a rounding apart neither weld nor
 * cancel.
 *
 * Two openings that meet at a corner are refused rather than cut. The standing
 * region would touch itself along one line, and an edge four triangles share is
 * not a surface; separating it needs the general boolean this kernel does not
 * have, so it raises its own diagnostic instead of emitting a pinched solid.
 *
 * The result carries flat per-face normals and no UV atlas.
 */
export const buildAutoMovieWall = (props: {
  width: number;
  height: number;
  depth: number;
  openings: readonly IAutoMovieWallOpening[];
}): IAutoMovieMesh => {
  positive(props.width, "wall width");
  positive(props.height, "wall height");
  positive(props.depth, "wall depth");
  const ids = new Set<string>();
  props.openings.forEach((opening, index) => {
    if (opening.id.trim().length === 0)
      throw new Error(`wall opening[${index}] id must be non-empty`);
    if (ids.has(opening.id))
      throw new Error(`wall opening id "${opening.id}" must be unique`);
    ids.add(opening.id);
    finiteOpening(opening, index);
    if (
      opening.x < 0 ||
      opening.y < 0 ||
      opening.x + opening.width > props.width ||
      opening.y + opening.height > props.height
    )
      throw new Error(`wall opening "${opening.id}" must stay inside the wall`);
  });
  for (let left = 0; left < props.openings.length; ++left)
    for (let right = left + 1; right < props.openings.length; ++right)
      if (overlaps(props.openings[left]!, props.openings[right]!))
        throw new Error(
          `wall openings "${props.openings[left]!.id}" and "${props.openings[right]!.id}" overlap`,
        );

  const xs = sortedCuts([
    0,
    props.width,
    ...props.openings.flatMap((opening) => [
      opening.x,
      opening.x + opening.width,
    ]),
  ]);
  const ys = sortedCuts([
    0,
    props.height,
    ...props.openings.flatMap((opening) => [
      opening.y,
      opening.y + opening.height,
    ]),
  ]);
  const columns = xs.length - 1;
  const rows = ys.length - 1;
  const standing: boolean[] = [];
  for (let x = 0; x < columns; ++x)
    for (let y = 0; y < rows; ++y) {
      const centerX = (xs[x]! + xs[x + 1]!) / 2;
      const centerY = (ys[y]! + ys[y + 1]!) / 2;
      standing.push(
        props.openings.every(
          (opening) =>
            centerX <= opening.x ||
            centerX >= opening.x + opening.width ||
            centerY <= opening.y ||
            centerY >= opening.y + opening.height,
        ),
      );
    }
  const stands = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < columns && y < rows && standing[x * rows + y]!;
  if (standing.some((cell) => cell) === false)
    throw new Error("wall openings remove the entire wall");
  for (let x = 1; x < columns; ++x)
    for (let y = 1; y < rows; ++y) {
      const lowerLeft = stands(x - 1, y - 1);
      const lowerRight = stands(x, y - 1);
      const upperLeft = stands(x - 1, y);
      const upperRight = stands(x, y);
      if (
        (lowerLeft && upperRight && !lowerRight && !upperLeft) ||
        (lowerRight && upperLeft && !lowerLeft && !upperRight)
      )
        throw new Error(
          `wall openings meet at (${xs[x]!}, ${ys[y]!}) and pinch the wall to a line`,
        );
    }

  const halfWidth = props.width / 2;
  const halfHeight = props.height / 2;
  const halfDepth = props.depth / 2;
  const target: { positions: number[]; normals: number[]; indices: number[] } =
    { positions: [], normals: [], indices: [] };
  for (let x = 0; x < columns; ++x)
    for (let y = 0; y < rows; ++y) {
      if (stands(x, y) === false) continue;
      const min = [
        xs[x]! - halfWidth,
        ys[y]! - halfHeight,
        -halfDepth,
      ] as const;
      const max = [
        xs[x + 1]! - halfWidth,
        ys[y + 1]! - halfHeight,
        halfDepth,
      ] as const;
      for (const [axis, outward, alongX, alongY] of WALL_CELL_SIDES)
        if (stands(x + alongX, y + alongY) === false)
          pushCellFace(target, min, max, axis, outward);
      pushCellFace(target, min, max, 2, 1);
      pushCellFace(target, min, max, 2, -1);
    }
  return {
    positions: target.positions,
    normals: target.normals,
    uvs: null,
    indices: target.indices,
    skin: null,
  };
};

/**
 * Triangulate a free-form planar region: one arbitrary ring less its holes.
 *
 * This is the kernel's escape from convexity. A convex hull is the wrong answer
 * for an L-shaped section, a channel, a cornice, or a tube, because the hull
 * covers ground the region does not; {@link extrudeAutoMovieProfile} refuses a
 * concave contour rather than quietly filling it in, and this is what the
 * refusal points at. The contour is taken as authored, each hole is bridged
 * into it, and the result is ear-clipped, so the triangles cover exactly the
 * enclosed area and nothing else.
 *
 * Rings are refused rather than repaired: fewer than three points, a non-finite
 * coordinate, a point repeated beside itself, a spike that doubles back along
 * its own edge, a ring enclosing no area, and a ring crossing itself each raise
 * their own diagnostic. Two rings may not touch or cross either, and a hole
 * must lie strictly inside the outer ring and outside every other hole. A hole
 * that does not is not a void this kernel guesses at; it is a region the author
 * has not described.
 *
 * Winding is canonicalized rather than demanded: the outer ring comes back
 * counter-clockwise and every hole clockwise, whichever way each was authored,
 * because which ring bounds the region and which is a void is settled by
 * containment and not by the order the points were typed in. The emitted
 * triangles are counter-clockwise, so the region faces +Z.
 */
export const triangulateAutoMovieRegion = (props: {
  outer: readonly IAutoMovieProfilePoint[];
  holes?: ReadonlyArray<readonly IAutoMovieProfilePoint[]>;
}): IAutoMovieRegionTriangulation =>
  triangulateRegion(props.outer, props.holes ?? [], "polygon");

/**
 * Extrude a free-form region, holes and all, into a closed prism along local Z.
 *
 * {@link extrudeAutoMovieProfile} hulls its profile, so an L-shaped section, a
 * channel, a frame section, and a hollow tube are all refused there. This one
 * takes the region {@link triangulateAutoMovieRegion} accepts, which is what
 * makes it also the arbitrary-shape opening this kernel otherwise lacks: a wall
 * whose outer ring is the panel and whose holes are an arch, a round oculus, or
 * any authored outline is one extrusion, and the opening is a real hole in the
 * solid rather than a rectangle {@link buildAutoMovieWall} could cut.
 *
 * Every triangle owns its corners, so the crease where a cap meets a side stays
 * a crease instead of being averaged into a rounded seam the way the older
 * builders leave it. The UV atlas is measured in metres and stated rather than
 * guessed: a cap carries its own profile coordinates, and a side carries the
 * distance travelled along its ring against the height along Z.
 *
 * The result is a closed 2-manifold whose volume is the region's area times the
 * depth, spanning `-depth / 2` to `+depth / 2` like the convex extrusion.
 */
export const extrudeAutoMovieRegion = (props: {
  outer: readonly IAutoMovieProfilePoint[];
  holes?: ReadonlyArray<readonly IAutoMovieProfilePoint[]>;
  depth: number;
}): IAutoMovieMesh => {
  positive(props.depth, "polygon extrusion depth");
  const plan = triangulateRegion(props.outer, props.holes ?? [], "polygon");
  const half = props.depth / 2;
  const target = emptyMeshTarget();
  for (const [outward, cap] of [
    [1, half],
    [-1, -half],
  ] as ReadonlyArray<readonly [1 | -1, number]>) {
    const base = target.positions.length / 3;
    for (const point of plan.points) {
      target.positions.push(point.x, point.y, cap);
      target.normals.push(0, 0, outward);
      target.uvs.push(point.x, point.y * outward);
    }
    for (let at = 0; at < plan.triangles.length; at += 3)
      target.indices.push(
        base + plan.triangles[at]!,
        base + plan.triangles[at + (outward === 1 ? 1 : 2)]!,
        base + plan.triangles[at + (outward === 1 ? 2 : 1)]!,
      );
  }
  for (const span of plan.rings) {
    let along = 0;
    for (let step = 0; step < span.count; ++step) {
      const from = plan.points[span.start + step]!;
      const to = plan.points[span.start + ((step + 1) % span.count)]!;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const normal = {
        x: (to.y - from.y) / length,
        y: (from.x - to.x) / length,
        z: 0,
      };
      const base = target.positions.length / 3;
      for (const [point, z, u] of [
        [from, half, along],
        [from, -half, along],
        [to, -half, along + length],
        [to, half, along + length],
      ] as ReadonlyArray<readonly [IAutoMovieProfilePoint, number, number]>) {
        target.positions.push(point.x, point.y, z);
        target.normals.push(normal.x, normal.y, normal.z);
        target.uvs.push(u, z);
      }
      target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      along += length;
    }
  }
  return { ...target, skin: null };
};

/**
 * Loft free-form sections along a path, interpolating the section between them.
 *
 * {@link sweepAutoMovieProfile} carries one hulled profile down the whole path,
 * so a tapered pier, a section that changes on the way, and any concave or
 * hollow section are all outside it. Here each station's section is the linear
 * blend of the two authored sections bracketing it, measured by chord length
 * along the path, which is the variable-section spine and the taper in one
 * operation: two sections that differ only in scale is a taper, two that differ
 * in shape is a loft, and the same section declared at both ends is a sweep of
 * a section {@link sweepAutoMovieProfile} would have hulled.
 *
 * Correspondence is authored, never inferred. Every section declares the same
 * rings with the same point counts wound the same way, and point `k` of a ring
 * blends into point `k` of that ring at the next section. A kernel that
 * resampled instead would silently decide which corner of a section becomes
 * which corner of the next, so a mismatch is refused with its own diagnostic.
 *
 * Both ends are capped from their own authored section, every triangle owns its
 * corners so the section's corners stay creases, and the UV atlas is metric:
 * the distance travelled around the section against the distance travelled
 * along the path. Whether the swept solid intersects itself is the author's to
 * decide, exactly as it is for a sweep: a path that turns tighter than the
 * section is wide folds the surface through itself, and this kernel measures
 * neither the turn nor the width.
 */
export const loftAutoMovieSections = (props: {
  path: readonly IAutoMovieVector3[];
  sections: readonly IAutoMovieLoftSection[];
}): IAutoMovieMesh => {
  if (props.path.length < 2)
    throw new Error("loft path needs at least two points");
  props.path.forEach((point, index) => {
    finiteVector(point, `loft path[${index}]`);
    if (
      index > 0 &&
      Vector3.length(Vector3.subtract(point, props.path[index - 1]!)) <=
        PLANAR_EPSILON
    )
      throw new Error(`loft path[${index}] repeats the point beside it`);
  });
  if (props.sections.length < 2)
    throw new Error("loft needs at least two sections");
  props.sections.forEach((section, index) => {
    if (Number.isFinite(section.at) === false)
      throw new Error(`loft section[${index}] at must be finite`);
    if (index > 0 && section.at <= props.sections[index - 1]!.at)
      throw new Error(
        `loft section[${index}] at must be greater than section[${index - 1}] at`,
      );
  });
  if (
    props.sections[0]!.at !== 0 ||
    props.sections[props.sections.length - 1]!.at !== 1
  )
    throw new Error("loft sections must run from at 0 to at 1");
  const plans = props.sections.map((section, index) =>
    triangulateRegion(
      section.outer,
      section.holes ?? [],
      `loft section[${index}]`,
    ),
  );
  const first = loftSectionRings(props.sections[0]!);
  props.sections.forEach((section, index) => {
    const rings = loftSectionRings(section);
    if (rings.length !== first.length)
      throw new Error(
        `loft section[${index}] must declare the same ${first.length} rings as section[0]`,
      );
    rings.forEach((ring, at) => {
      if (ring.length !== first[at]!.length)
        throw new Error(
          `loft section[${index}] ring[${at}] must carry the same ${first[at]!.length} points as section[0]`,
        );
      if (Math.sign(signedArea(ring)) !== Math.sign(signedArea(first[at]!)))
        throw new Error(
          `loft section[${index}] ring[${at}] must wind the same way as section[0]`,
        );
    });
  });

  const travelled = [0];
  for (let index = 1; index < props.path.length; ++index)
    travelled.push(
      travelled[index - 1]! +
        Vector3.length(
          Vector3.subtract(props.path[index]!, props.path[index - 1]!),
        ),
    );
  const total = travelled[travelled.length - 1]!;
  const stations = props.path.map((point, index) => {
    const tangent = tangentAt(props.path, index, "loft path");
    const guide =
      Math.abs(tangent.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const right = Vector3.normalize(Vector3.cross(guide, tangent));
    const up = Vector3.normalize(Vector3.cross(tangent, right));
    const profile = loftSectionAt(
      plans,
      props.sections,
      travelled[index]! / total,
    );
    return {
      tangent,
      profile,
      points: profile.map((corner) => ({
        x: point.x + right.x * corner.x + up.x * corner.y,
        y: point.y + right.y * corner.x + up.y * corner.y,
        z: point.z + right.z * corner.x + up.z * corner.y,
      })),
    };
  });

  const target = emptyMeshTarget();
  for (const [outward, station, plan] of [
    [-1, stations[0]!, plans[0]!],
    [1, stations[stations.length - 1]!, plans[plans.length - 1]!],
  ] as ReadonlyArray<
    readonly [1 | -1, (typeof stations)[number], IAutoMovieRegionTriangulation]
  >) {
    const base = target.positions.length / 3;
    station.points.forEach((point, index) => {
      target.positions.push(point.x, point.y, point.z);
      target.normals.push(
        station.tangent.x * outward,
        station.tangent.y * outward,
        station.tangent.z * outward,
      );
      target.uvs.push(
        station.profile[index]!.x,
        station.profile[index]!.y * outward,
      );
    });
    for (let at = 0; at < plan.triangles.length; at += 3)
      target.indices.push(
        base + plan.triangles[at]!,
        base + plan.triangles[at + (outward === 1 ? 1 : 2)]!,
        base + plan.triangles[at + (outward === 1 ? 2 : 1)]!,
      );
  }
  for (const span of plans[0]!.rings)
    for (let leg = 0; leg + 1 < stations.length; ++leg) {
      const near = stations[leg]!;
      const far = stations[leg + 1]!;
      let nearAlong = 0;
      let farAlong = 0;
      for (let step = 0; step < span.count; ++step) {
        const head = span.start + step;
        const tail = span.start + ((step + 1) % span.count);
        const nearLength = Math.hypot(
          near.profile[tail]!.x - near.profile[head]!.x,
          near.profile[tail]!.y - near.profile[head]!.y,
        );
        const farLength = Math.hypot(
          far.profile[tail]!.x - far.profile[head]!.x,
          far.profile[tail]!.y - far.profile[head]!.y,
        );
        const corners = [
          [far.points[head]!, farAlong, travelled[leg + 1]!],
          [near.points[head]!, nearAlong, travelled[leg]!],
          [near.points[tail]!, nearAlong + nearLength, travelled[leg]!],
          [far.points[tail]!, farAlong + farLength, travelled[leg + 1]!],
        ] as ReadonlyArray<readonly [IAutoMovieVector3, number, number]>;
        pushFlatTriangle(target, [corners[0]!, corners[1]!, corners[2]!]);
        pushFlatTriangle(target, [corners[0]!, corners[2]!, corners[3]!]);
        nearAlong += nearLength;
        farAlong += farLength;
      }
    }
  return { ...target, skin: null };
};

/**
 * Merge rigid meshes, rebasing their indices in declared order.
 *
 * Every buffer is appended element by element rather than by spreading the
 * source into `push`. A spread is an argument list, and an argument list has a
 * length limit in the low hundreds of thousands: `push(...positions)` throws
 * `Maximum call stack size exceeded` once one member passes roughly forty
 * thousand vertices. Merging a building's members past that size is the whole
 * reason this function exists, so the limit is not one worth inheriting.
 */
export const mergeAutoMovieMeshes = (
  meshes: readonly IAutoMovieMesh[],
): IAutoMovieMesh => {
  if (meshes.some((mesh) => mesh.skin !== null))
    throw new Error("procedural rigid-mesh merge does not accept skinning");
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const keepNormals = meshes.every((mesh) => mesh.normals !== null);
  const keepUvs = meshes.every((mesh) => mesh.uvs !== null);
  const uvs: number[] = [];
  for (const mesh of meshes) {
    const base = positions.length / 3;
    const count = mesh.positions.length / 3;
    for (const value of mesh.positions) positions.push(value);
    if (keepNormals) for (const value of mesh.normals!) normals.push(value);
    if (keepUvs) for (const value of mesh.uvs!) uvs.push(value);
    if (mesh.indices === null)
      for (let index = 0; index < count; ++index) indices.push(index + base);
    else for (const index of mesh.indices) indices.push(index + base);
  }
  return {
    positions,
    normals: keepNormals ? normals : null,
    uvs: keepUvs ? uvs : null,
    indices,
    skin: null,
  };
};

/**
 * Place a rigid mesh by translation, unit quaternion, and per-axis scale.
 *
 * Positions take the full placement, normals take the inverse transpose (so a
 * non-uniform scale does not tilt them off the surface), and a mirroring scale
 * flips triangle winding so the outward face stays outward. UVs ride along
 * untouched, because a placement moves a surface without re-cutting its atlas.
 */
export const transformAutoMovieMesh = (
  mesh: IAutoMovieMesh,
  transform: IAutoMovieMeshTransform,
): IAutoMovieMesh => {
  if (mesh.skin !== null)
    throw new Error("procedural mesh transform does not accept skinning");
  const triangles = triangleIndicesOf(mesh, "mesh transform");
  const translation = transform.translation ?? { x: 0, y: 0, z: 0 };
  finiteVector(translation, "mesh transform translation");
  const rotation = transform.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  if (
    ![rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite) ||
    Math.abs(Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) - 1) >
      1e-6
  )
    throw new Error("mesh transform rotation must be a unit quaternion");
  const scale = transform.scale ?? { x: 1, y: 1, z: 1 };
  finiteVector(scale, "mesh transform scale");
  if (scale.x === 0 || scale.y === 0 || scale.z === 0)
    throw new Error("mesh transform scale may not collapse an axis");
  const positions: number[] = [];
  for (let index = 0; index < mesh.positions.length; index += 3) {
    const placed = Quaternion.rotateVector(rotation, {
      x: mesh.positions[index]! * scale.x,
      y: mesh.positions[index + 1]! * scale.y,
      z: mesh.positions[index + 2]! * scale.z,
    });
    positions.push(
      placed.x + translation.x,
      placed.y + translation.y,
      placed.z + translation.z,
    );
  }
  const source = mesh.normals ?? [];
  const normals: number[] = [];
  for (let index = 0; index < source.length; index += 3) {
    const turned = Vector3.normalize(
      Quaternion.rotateVector(rotation, {
        x: source[index]! / scale.x,
        y: source[index + 1]! / scale.y,
        z: source[index + 2]! / scale.z,
      }),
    );
    normals.push(turned.x, turned.y, turned.z);
  }
  const mirrored = scale.x * scale.y * scale.z < 0;
  const indices: number[] = [];
  for (let index = 0; index < triangles.length; index += 3)
    indices.push(
      triangles[index]!,
      triangles[index + (mirrored ? 2 : 1)]!,
      triangles[index + (mirrored ? 1 : 2)]!,
    );
  return {
    positions,
    normals: mesh.normals === null ? null : normals,
    uvs: mesh.uvs === null ? null : [...mesh.uvs],
    indices,
    skin: null,
  };
};

/**
 * Merge placed rigid members and report the index range each one owns.
 *
 * A material group is what lets one merged draw call still say which triangles
 * are the tread and which are the riser, so a finish, a budget, or a quantity
 * take-off can address a member after the buffers were concatenated.
 */
export const mergeAutoMovieMeshParts = (
  parts: readonly IAutoMovieMeshPart[],
): IAutoMovieMeshAssembly => {
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.id.trim().length === 0)
      throw new Error("mesh part id must be non-empty");
    if (seen.has(part.id))
      throw new Error(`mesh part id "${part.id}" must be unique`);
    seen.add(part.id);
  }
  const placed = parts.map((part) => {
    triangleIndicesOf(part.mesh, `mesh part "${part.id}"`);
    return part.transform === undefined
      ? part.mesh
      : transformAutoMovieMesh(part.mesh, part.transform);
  });
  const groups: IAutoMovieMeshGroup[] = [];
  let start = 0;
  placed.forEach((mesh, index) => {
    const count = mesh.indices?.length ?? mesh.positions.length / 3;
    groups.push({ id: parts[index]!.id, start, count });
    start += count;
  });
  return { mesh: mergeAutoMovieMeshes(placed), groups };
};

/**
 * Measure a mesh's triangle topology instead of assuming it.
 *
 * Vertices weld by position, because a builder that gives each face its own
 * corners is still one closed shell. A closed solid must report `watertight`;
 * an assembly of members that share faces, or a surface meant to stay open,
 * reports its boundary and non-manifold edge counts rather than pretending.
 *
 * This measures; it does not judge. `validateMeshTopology` is the engine's
 * verdict on the same surface, adding winding consistency and an `expectClosed`
 * declaration, and it is what `validateModel` runs over every mesh a model
 * carries. A builder that wants a pass or a fail asks that one.
 */
export const inspectAutoMovieMeshTopology = (
  mesh: IAutoMovieMesh,
): IAutoMovieMeshTopology => {
  const nonFinite =
    countNonFinite(mesh.positions) +
    countNonFinite(mesh.normals) +
    countNonFinite(mesh.uvs);
  const indices = triangleIndicesOf(mesh, "mesh topology");
  const key = (at: number): string =>
    [0, 1, 2]
      .map((axis) => Math.round(mesh.positions[at * 3 + axis]! * WELD_SCALE))
      .join(",");
  const edges = new Map<string, number>();
  let degenerate = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const corners = [0, 1, 2].map((corner) => key(indices[index + corner]!));
    if (new Set(corners).size < 3) {
      degenerate += 1;
      continue;
    }
    for (let edge = 0; edge < 3; ++edge) {
      // The degenerate skip above leaves three distinct corner keys, so the
      // two ends of an edge can never compare equal here.
      const name = [corners[edge]!, corners[(edge + 1) % 3]!]
        .sort((left, right) => (left < right ? -1 : 1))
        .join("|");
      edges.set(name, (edges.get(name) ?? 0) + 1);
    }
  }
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edges.values())
    if (count === 1) boundaryEdges += 1;
    else if (count > 2) nonManifoldEdges += 1;
  let sixVolume = 0;
  const p = mesh.positions;
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index]! * 3;
    const b = indices[index + 1]! * 3;
    const c = indices[index + 2]! * 3;
    sixVolume +=
      p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) +
      p[a + 1]! * (p[b + 2]! * p[c]! - p[b]! * p[c + 2]!) +
      p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!);
  }
  return {
    triangles: indices.length / 3,
    degenerate,
    nonFinite,
    boundaryEdges,
    nonManifoldEdges,
    watertight: edges.size > 0 && boundaryEdges === 0 && nonManifoldEdges === 0,
    volume: sixVolume / 6,
  };
};

/**
 * The triangle index run a mesh carries, refused rather than read past its end.
 *
 * An index array that is not a whole number of triangles, or that names a
 * vertex the mesh does not carry, would otherwise read `undefined` and emit
 * `NaN` positions and a `NaN` volume that no downstream check attributes back
 * to the malformed input.
 */
const triangleIndicesOf = (mesh: IAutoMovieMesh, label: string): number[] => {
  const vertices = mesh.positions.length / 3;
  if (Number.isSafeInteger(vertices) === false)
    throw new Error(`${label} needs positions in whole xyz triples`);
  const indices =
    mesh.indices ?? Array.from({ length: vertices }, (_, index) => index);
  if (indices.length % 3 !== 0)
    throw new Error(`${label} needs triangle indices in threes`);
  if (
    indices.some(
      (index) =>
        Number.isSafeInteger(index) === false || index < 0 || index >= vertices,
    )
  )
    throw new Error(`${label} indexes a vertex the mesh does not carry`);
  return indices;
};

/**
 * The four in-plane sides of a wall cell, each with the neighbour that hides
 * it. The two depth faces have no neighbour in a one-cell-deep wall and are
 * always emitted, so they are not listed.
 */
const WALL_CELL_SIDES: ReadonlyArray<
  readonly [axis: 0 | 1, outward: 1 | -1, alongX: number, alongY: number]
> = [
  [0, 1, 1, 0],
  [0, -1, -1, 0],
  [1, 1, 0, 1],
  [1, -1, 0, -1],
];

/**
 * Append one outward face of an axis-aligned cell, wound counter-clockwise seen
 * from outside.
 *
 * The two in-plane axes are taken in the cyclic order after the face's own
 * axis, so the corner cycle's right-hand normal IS the face's outward normal by
 * construction. A hand-written corner table would instead have to be kept in
 * step with the winding it claims, which is the kind of table that goes stale
 * without saying so.
 */
const pushCellFace = (
  target: { positions: number[]; normals: number[]; indices: number[] },
  min: readonly [number, number, number],
  max: readonly [number, number, number],
  axis: 0 | 1 | 2,
  outward: 1 | -1,
): void => {
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const plane = outward === 1 ? max[axis]! : min[axis]!;
  const corners: ReadonlyArray<readonly [number, number]> =
    outward === 1
      ? [
          [min[u]!, min[v]!],
          [max[u]!, min[v]!],
          [max[u]!, max[v]!],
          [min[u]!, max[v]!],
        ]
      : [
          [min[u]!, min[v]!],
          [min[u]!, max[v]!],
          [max[u]!, max[v]!],
          [max[u]!, min[v]!],
        ];
  const normal = [0, 0, 0];
  normal[axis] = outward;
  const base = target.positions.length / 3;
  for (const [alongU, alongV] of corners) {
    const point = [0, 0, 0];
    point[axis] = plane;
    point[u] = alongU;
    point[v] = alongV;
    target.positions.push(point[0]!, point[1]!, point[2]!);
    target.normals.push(normal[0]!, normal[1]!, normal[2]!);
  }
  target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
};

/** The buffers a flat-shaded builder fills before it becomes a mesh. */
interface IMeshTarget {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

const emptyMeshTarget = (): IMeshTarget => ({
  positions: [],
  normals: [],
  uvs: [],
  indices: [],
});

/**
 * Append one triangle that owns its three corners and its own plane normal.
 *
 * A lofted quad is only planar when its two sections match, so the two halves
 * of a changing section's quad genuinely face different ways. Giving each
 * triangle its own corners is what lets each carry the normal its own plane
 * has, instead of one averaged direction that neither half points in.
 */
const pushFlatTriangle = (
  target: IMeshTarget,
  corners: readonly [
    readonly [IAutoMovieVector3, number, number],
    readonly [IAutoMovieVector3, number, number],
    readonly [IAutoMovieVector3, number, number],
  ],
): void => {
  const normal = Vector3.normalize(
    Vector3.cross(
      Vector3.subtract(corners[1][0], corners[0][0]),
      Vector3.subtract(corners[2][0], corners[0][0]),
    ),
  );
  const base = target.positions.length / 3;
  for (const [point, u, v] of corners) {
    target.positions.push(point.x, point.y, point.z);
    target.normals.push(normal.x, normal.y, normal.z);
    target.uvs.push(u, v);
  }
  target.indices.push(base, base + 1, base + 2);
};

/**
 * Triangulate one region, naming its rings the way its caller calls them.
 *
 * The public entry says `polygon`, a loft says which section it is checking, so
 * an author reading a refusal learns which of six sections carries the ring
 * that crosses itself rather than that "the outer ring" does.
 */
const triangulateRegion = (
  outer: readonly IAutoMovieProfilePoint[],
  holes: ReadonlyArray<readonly IAutoMovieProfilePoint[]>,
  label: string,
): IAutoMovieRegionTriangulation => {
  const labels = [
    `${label} outer ring`,
    ...holes.map((_hole, index) => `${label} hole[${index}]`),
  ];
  const loops = [outer, ...holes].map((ring, index) =>
    orientedRing(simpleRing(ring, labels[index]!), index === 0),
  );
  refuseRingContacts(loops, labels);
  refuseHolePlacement(loops, labels);
  const points: IAutoMovieProfilePoint[] = [];
  const rings: IAutoMovieRegionRing[] = [];
  for (const loop of loops) {
    rings.push({ start: points.length, count: loop.length });
    for (const point of loop) points.push(point);
  }
  return {
    points,
    rings,
    triangles: earClip(points, bridgeHoles(points, rings)),
    area: loops.reduce((total, loop) => total + signedArea(loop), 0),
  };
};

/**
 * Copy one ring, refusing every shape a triangulator cannot answer for.
 *
 * A ring that repeats a point beside itself carries a zero-length edge with no
 * direction, one that doubles back along its own edge encloses a sliver of no
 * width, and one that crosses itself encloses two regions with opposite signs.
 * None of the three is repaired here: which of the shapes the author meant is
 * exactly what the input failed to say.
 */
const simpleRing = (
  ring: readonly IAutoMovieProfilePoint[],
  label: string,
): IAutoMovieProfilePoint[] => {
  if (ring.length < 3) throw new Error(`${label} needs at least three points`);
  ring.forEach((point, index) => finitePoint(point, `${label}[${index}]`));
  const points = ring.map((point) => ({ x: point.x, y: point.y }));
  const size = points.length;
  points.forEach((point, index) => {
    const previous = points[(index + size - 1) % size]!;
    const next = points[(index + 1) % size]!;
    if (Math.hypot(next.x - point.x, next.y - point.y) <= PLANAR_EPSILON)
      throw new Error(`${label}[${index}] repeats the point beside it`);
    if (
      Math.abs(cross2(previous, point, next)) <= PLANAR_EPSILON &&
      (point.x - previous.x) * (next.x - point.x) +
        (point.y - previous.y) * (next.y - point.y) <
        0
    )
      throw new Error(`${label}[${index}] doubles back along its own edge`);
  });
  if (Math.abs(signedArea(points)) <= PLANAR_EPSILON)
    throw new Error(`${label} encloses no area`);
  for (let left = 0; left < size; ++left)
    for (let right = left + 1; right < size; ++right)
      if (
        neighbouringEdges(size, left, right) === false &&
        segmentsMeet(
          points[left]!,
          points[(left + 1) % size]!,
          points[right]!,
          points[(right + 1) % size]!,
        )
      )
        throw new Error(
          `${label} crosses itself between edge ${left} and edge ${right}`,
        );
  return points;
};

/** Are two edges of the same ring the pair that share a corner? */
const neighbouringEdges = (
  size: number,
  left: number,
  right: number,
): boolean => (left + 1) % size === right || (right + 1) % size === left;

/** The ring wound the way asked for; reversing keeps its first point first. */
const orientedRing = (
  points: IAutoMovieProfilePoint[],
  counterClockwise: boolean,
): IAutoMovieProfilePoint[] =>
  signedArea(points) > 0 === counterClockwise ? points : points.reverse();

/** Twice the shoelace sum, halved: positive counter-clockwise, in m². */
const signedArea = (points: readonly IAutoMovieProfilePoint[]): number => {
  let total = 0;
  for (let index = 0; index < points.length; ++index) {
    const from = points[index]!;
    const to = points[(index + 1) % points.length]!;
    total += from.x * to.y - to.x * from.y;
  }
  return total / 2;
};

/** Twice the signed area of the triangle `origin -> from -> to`. */
const cross2 = (
  origin: IAutoMovieProfilePoint,
  from: IAutoMovieProfilePoint,
  to: IAutoMovieProfilePoint,
): number =>
  (from.x - origin.x) * (to.y - origin.y) -
  (from.y - origin.y) * (to.x - origin.x);

/**
 * Do two segments share any point at all, touching included?
 *
 * Touching counts because a region whose rings meet at one point is not two
 * regions with a shared corner; it is a surface pinched to a line, the same
 * shape {@link buildAutoMovieWall} refuses when two openings meet at a corner.
 */
const segmentsMeet = (
  fromA: IAutoMovieProfilePoint,
  toA: IAutoMovieProfilePoint,
  fromB: IAutoMovieProfilePoint,
  toB: IAutoMovieProfilePoint,
): boolean => {
  if (
    straddles(cross2(fromB, toB, fromA), cross2(fromB, toB, toA)) &&
    straddles(cross2(fromA, toA, fromB), cross2(fromA, toA, toB))
  )
    return true;
  const contacts: ReadonlyArray<
    readonly [
      IAutoMovieProfilePoint,
      IAutoMovieProfilePoint,
      IAutoMovieProfilePoint,
    ]
  > = [
    [fromB, toB, fromA],
    [fromB, toB, toA],
    [fromA, toA, fromB],
    [fromA, toA, toB],
  ];
  return contacts.some(([from, to, point]) => {
    if (Math.abs(cross2(from, to, point)) > PLANAR_EPSILON) return false;
    const spanX = to.x - from.x;
    const spanY = to.y - from.y;
    const along =
      ((point.x - from.x) * spanX + (point.y - from.y) * spanY) /
      (spanX * spanX + spanY * spanY);
    return along >= -PLANAR_EPSILON && along <= 1 + PLANAR_EPSILON;
  });
};

/** Are two points on strictly opposite sides of the same line? */
const straddles = (left: number, right: number): boolean =>
  Math.abs(left) > PLANAR_EPSILON &&
  Math.abs(right) > PLANAR_EPSILON &&
  left * right < 0;

/** Refuse any two distinct rings that touch or cross. */
const refuseRingContacts = (
  loops: ReadonlyArray<readonly IAutoMovieProfilePoint[]>,
  labels: readonly string[],
): void => {
  for (let left = 0; left + 1 < loops.length; ++left)
    for (let right = left + 1; right < loops.length; ++right) {
      const one = loops[left]!;
      const other = loops[right]!;
      for (let a = 0; a < one.length; ++a)
        for (let b = 0; b < other.length; ++b)
          if (
            segmentsMeet(
              one[a]!,
              one[(a + 1) % one.length]!,
              other[b]!,
              other[(b + 1) % other.length]!,
            )
          )
            throw new Error(
              `${labels[left]} and ${labels[right]} touch or cross at edge ${a} and edge ${b}`,
            );
    }
};

/**
 * Refuse a hole the outer ring does not contain, or that another hole does.
 *
 * One probe point decides it, because {@link refuseRingContacts} already
 * established that no two rings meet: a ring that neither crosses nor touches
 * another lies wholly inside it or wholly outside it, so the first point speaks
 * for all of them.
 */
const refuseHolePlacement = (
  loops: ReadonlyArray<readonly IAutoMovieProfilePoint[]>,
  labels: readonly string[],
): void => {
  for (let hole = 1; hole < loops.length; ++hole) {
    const probe = loops[hole]![0]!;
    if (pointInRing(probe, loops[0]!) === false)
      throw new Error(`${labels[hole]} must lie inside ${labels[0]}`);
    for (let other = 1; other < loops.length; ++other)
      if (other !== hole && pointInRing(probe, loops[other]!))
        throw new Error(`${labels[hole]} must lie outside ${labels[other]}`);
  }
};

/** Even-odd ray cast along +X; the caller guarantees the point is off-ring. */
const pointInRing = (
  point: IAutoMovieProfilePoint,
  ring: readonly IAutoMovieProfilePoint[],
): boolean => {
  let inside = false;
  for (let index = 0; index < ring.length; ++index) {
    const from = ring[index]!;
    const to = ring[(index + 1) % ring.length]!;
    if (
      from.y > point.y !== to.y > point.y &&
      point.x <
        from.x + ((point.y - from.y) / (to.y - from.y)) * (to.x - from.x)
    )
      inside = !inside;
  }
  return inside;
};

/**
 * Fold every hole into the outer ring along a bridge nothing else crosses.
 *
 * The bridge is a segment travelled in both directions, so the region becomes
 * one ring an ear clipper can consume while the void stays a void: the two
 * traversals meet nothing between them. The pair is searched in declared order,
 * which is what keeps the same input producing the same triangles.
 *
 * A hole validated as strictly inside the region and meeting no other ring
 * always has a mutually visible vertex to bridge to, which is why the search is
 * read as total rather than guarded: the guard would answer a question
 * {@link refuseHolePlacement} and {@link refuseRingContacts} already settled.
 */
const bridgeHoles = (
  points: readonly IAutoMovieProfilePoint[],
  rings: readonly IAutoMovieRegionRing[],
): number[] => {
  const loops = rings.map((span) =>
    Array.from({ length: span.count }, (_unused, index) => span.start + index),
  );
  const ring = [...loops[0]!];
  for (let hole = 1; hole < loops.length; ++hole) {
    const bridge = ring
      .flatMap((_anchor, at) =>
        loops[hole]!.map((_corner, from) => ({ at, from })),
      )
      .find((candidate) =>
        bridgeIsClear(points, rings, ring, loops, hole, candidate),
      )!;
    const rotated = [
      ...loops[hole]!.slice(bridge.from),
      ...loops[hole]!.slice(0, bridge.from),
    ];
    const anchor = ring[bridge.at]!;
    const tail = ring.splice(bridge.at + 1);
    for (const index of rotated) ring.push(index);
    ring.push(rotated[0]!, anchor);
    for (const index of tail) ring.push(index);
  }
  return ring;
};

/** Does one candidate bridge stay inside the region and meet nothing? */
const bridgeIsClear = (
  points: readonly IAutoMovieProfilePoint[],
  rings: readonly IAutoMovieRegionRing[],
  ring: readonly number[],
  loops: ReadonlyArray<readonly number[]>,
  hole: number,
  candidate: { at: number; from: number },
): boolean => {
  const start = points[ring[candidate.at]!]!;
  const end = points[loops[hole]![candidate.from]!]!;
  const size = ring.length;
  for (let edge = 0; edge < size; ++edge)
    if (
      edge !== candidate.at &&
      edge !== (candidate.at + size - 1) % size &&
      segmentsMeet(
        start,
        end,
        points[ring[edge]!]!,
        points[ring[(edge + 1) % size]!]!,
      )
    )
      return false;
  for (let other = hole; other < loops.length; ++other) {
    const loop = loops[other]!;
    for (let edge = 0; edge < loop.length; ++edge)
      if (
        (other !== hole ||
          (edge !== candidate.from &&
            edge !== (candidate.from + loop.length - 1) % loop.length)) &&
        segmentsMeet(
          start,
          end,
          points[loop[edge]!]!,
          points[loop[(edge + 1) % loop.length]!]!,
        )
      )
        return false;
  }
  const middle = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const ringPoints = (span: IAutoMovieRegionRing): IAutoMovieProfilePoint[] =>
    points.slice(span.start, span.start + span.count);
  return (
    pointInRing(middle, ringPoints(rings[0]!)) &&
    rings
      .slice(1)
      .every((span) => pointInRing(middle, ringPoints(span)) === false)
  );
};

/**
 * Cut ears off one counter-clockwise ring until three corners are left.
 *
 * The loop counts down from the ring's own size rather than testing for
 * failure, because the two-ears theorem gives a validated simple ring an ear at
 * every step: the polygon reaching here has been refused if it crosses itself,
 * touches another ring, or carries a hole outside the region, and a guard here
 * would be a second answer to a question already settled.
 */
const earClip = (
  points: readonly IAutoMovieProfilePoint[],
  ring: readonly number[],
): number[] => {
  const working = [...ring];
  const triangles: number[] = [];
  for (let remaining = working.length; remaining > 3; --remaining) {
    const size = working.length;
    const at = working.findIndex((_corner, index) =>
      isEar(points, working, index),
    );
    triangles.push(
      working[(at + size - 1) % size]!,
      working[at]!,
      working[(at + 1) % size]!,
    );
    working.splice(at, 1);
  }
  triangles.push(working[0]!, working[1]!, working[2]!);
  return triangles;
};

/**
 * Is the corner at `at` an ear: convex, with no reflex corner inside it?
 *
 * Only reflex corners can block an ear, and only strictly inside ones, which is
 * what lets a bridged ring work: a bridge repeats one corner of each ring it
 * joins, and a repeated corner sits on the candidate triangle's boundary rather
 * than in its interior.
 */
const isEar = (
  points: readonly IAutoMovieProfilePoint[],
  ring: readonly number[],
  at: number,
): boolean => {
  const size = ring.length;
  const previousAt = (at + size - 1) % size;
  const nextAt = (at + 1) % size;
  const previous = points[ring[previousAt]!]!;
  const corner = points[ring[at]!]!;
  const next = points[ring[nextAt]!]!;
  if (cross2(previous, corner, next) <= PLANAR_EPSILON) return false;
  return ring.every((vertex, index) => {
    if (index === previousAt || index === at || index === nextAt) return true;
    return (
      isReflex(points, ring, index) === false ||
      insideTriangle(previous, corner, next, points[vertex]!) === false
    );
  });
};

/** Does the ring turn clockwise at this corner, cutting into the region? */
const isReflex = (
  points: readonly IAutoMovieProfilePoint[],
  ring: readonly number[],
  at: number,
): boolean =>
  cross2(
    points[ring[(at + ring.length - 1) % ring.length]!]!,
    points[ring[at]!]!,
    points[ring[(at + 1) % ring.length]!]!,
  ) < -PLANAR_EPSILON;

/** Is the point strictly inside the counter-clockwise triangle `a b c`? */
const insideTriangle = (
  a: IAutoMovieProfilePoint,
  b: IAutoMovieProfilePoint,
  c: IAutoMovieProfilePoint,
  point: IAutoMovieProfilePoint,
): boolean =>
  cross2(a, b, point) > PLANAR_EPSILON &&
  cross2(b, c, point) > PLANAR_EPSILON &&
  cross2(c, a, point) > PLANAR_EPSILON;

/** One loft section's rings in canonical declaration order. */
const loftSectionRings = (
  section: IAutoMovieLoftSection,
): ReadonlyArray<readonly IAutoMovieProfilePoint[]> => [
  section.outer,
  ...(section.holes ?? []),
];

/**
 * The section at one fraction of the path, blended from the two around it.
 *
 * The blend is written as `(1 - t) * a + t * b` rather than `a + (b - a) * t`
 * so a station landing exactly on a declared section reproduces that section's
 * coordinates bit for bit, which is what lets the end caps be triangulated from
 * the authored section and still sit on the surface the sides sweep out.
 */
const loftSectionAt = (
  plans: readonly IAutoMovieRegionTriangulation[],
  declared: readonly IAutoMovieLoftSection[],
  fraction: number,
): IAutoMovieProfilePoint[] => {
  let span = 0;
  while (span + 2 < declared.length && declared[span + 1]!.at <= fraction)
    ++span;
  const from = declared[span]!.at;
  const progress = (fraction - from) / (declared[span + 1]!.at - from);
  const before = plans[span]!.points;
  const after = plans[span + 1]!.points;
  return before.map((point, index) => ({
    x: point.x * (1 - progress) + after[index]!.x * progress,
    y: point.y * (1 - progress) + after[index]!.y * progress,
  }));
};

/** Welding grid for topology queries: 1 nm, far below any building tolerance. */
const WELD_SCALE = 1e9;

/**
 * Largest cross product or distance a free-form ring may call zero.
 *
 * Three orders of magnitude below {@link FACE_EPSILON}, because a cross product
 * is an area and an arc drawn at millimetre resolution turns through one at
 * every corner: at 1e-9 a finely tessellated arch would read as a straight line
 * and lose every ear the triangulator needs.
 */
const PLANAR_EPSILON = 1e-12;

/** Largest out-of-plane or degenerate-area slack one authored face may carry. */
const FACE_EPSILON = 1e-9;

const profileHull = (
  profile: readonly IAutoMovieProfilePoint[],
): IAutoMovieProfilePoint[] => {
  profile.forEach((point, index) => finitePoint(point, `profile[${index}]`));
  const hull = convexHull2D(
    profile.map((point) => ({ x: point.x, y: 0, z: point.y })),
  ).map((point) => ({ x: point.x, y: point.z }));
  if (hull.length < 3)
    throw new Error("profile needs at least three non-collinear points");
  if (hull.length !== profile.length)
    throw new Error("profile must be convex and contain no interior points");
  return hull;
};

const tangentAt = (
  path: readonly IAutoMovieVector3[],
  index: number,
  label: string,
): IAutoMovieVector3 => {
  const from = index === 0 ? path[0]! : path[index - 1]!;
  const to = index + 1 === path.length ? path[index]! : path[index + 1]!;
  const delta = Vector3.subtract(to, from);
  if (Vector3.length(delta) <= Number.EPSILON)
    throw new Error(`${label} around point ${index} is degenerate`);
  return Vector3.normalize(delta);
};

const meshOf = (positions: number[], indices: number[]): IAutoMovieMesh => ({
  positions,
  normals: normalsOf(positions, indices),
  uvs: null,
  indices,
  skin: null,
});

const normalsOf = (positions: number[], indices: number[]): number[] => {
  const normals = new Array<number>(positions.length).fill(0);
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index]! * 3;
    const b = indices[index + 1]! * 3;
    const c = indices[index + 2]! * 3;
    const ab = {
      x: positions[b]! - positions[a]!,
      y: positions[b + 1]! - positions[a + 1]!,
      z: positions[b + 2]! - positions[a + 2]!,
    };
    const ac = {
      x: positions[c]! - positions[a]!,
      y: positions[c + 1]! - positions[a + 1]!,
      z: positions[c + 2]! - positions[a + 2]!,
    };
    const normal = Vector3.cross(ab, ac);
    for (const offset of [a, b, c]) {
      normals[offset] += normal.x;
      normals[offset + 1] += normal.y;
      normals[offset + 2] += normal.z;
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const normal = Vector3.normalize({
      x: normals[index]!,
      y: normals[index + 1]!,
      z: normals[index + 2]!,
    });
    normals[index] = normal.x;
    normals[index + 1] = normal.y;
    normals[index + 2] = normal.z;
  }
  return normals;
};

/**
 * How many components of one optional attribute buffer are not finite numbers.
 *
 * Counted in place rather than over a concatenation, so measuring a merged
 * building does not first allocate a second copy of all of it.
 */
const countNonFinite = (values: readonly number[] | null): number => {
  if (values === null) return 0;
  let count = 0;
  for (const value of values) if (Number.isFinite(value) === false) ++count;
  return count;
};

const sortedCuts = (values: number[]): number[] =>
  [...new Set(values)].sort((left, right) => left - right);

const overlaps = (
  left: IAutoMovieWallOpening,
  right: IAutoMovieWallOpening,
): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const finiteOpening = (opening: IAutoMovieWallOpening, index: number): void => {
  finitePoint(opening, `wall opening[${index}]`);
  positive(opening.width, `wall opening[${index}] width`);
  positive(opening.height, `wall opening[${index}] height`);
};

const finitePoint = (point: IAutoMovieProfilePoint, label: string): void => {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error(`${label} must be finite`);
};

const finiteVector = (point: IAutoMovieVector3, label: string): void => {
  if (![point.x, point.y, point.z].every(Number.isFinite))
    throw new Error(`${label} must be finite`);
};

const positive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be a finite number > 0`);
};

const countAtLeast = (value: number, least: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < least)
    throw new Error(`${label} must be a safe integer >= ${least}`);
};
