/**
 * Directional triangle queries shared by skin contact and canthal attachment.
 * All mesh buffers, points, clearances and returned targets use engine metres.
 * An orthonormal frame maps the declared forward direction onto the engine's
 * depth sampler; queries retain transverse projection. Point intersection may
 * travel either way, point contact advances only, and complete-triangle contact
 * conservatively advances all corners by each face's maximum deficit. Inputs
 * remain owned by callers; consumers apply targets and recompute their normals.
 */
import {
  Vector3,
  createAutoMovieMeshDepthSampler,
  measureAutoMovieMeshClearance,
} from "@automovie/engine";
import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

/**
 * Intersect the foremost resident triangle along a fixed forward direction.
 * Inputs and output use engine metres. A point on either side of the surface
 * reaches the same hit; an uncovered projection returns null. Project the
 * original point directly, since moving it along the ray before projection
 * can round a boundary vertex outside the mesh's indexed footprint.
 *
 * The canthal support consumer uses this query for the same faces it draws.
 * Frame construction and mesh projection are shared with directional contact;
 * neither this query nor contact changes the caller's mesh or point.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Resolves an attachment to its actual resident surface while retaining the original observation projection.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Intersects the foremost triangle in one orthonormal directional frame without first translating the query origin.
 */
export function createPortraitDirectionalIntersection(
  mesh: IAutoMovieMesh,
  direction: IAutoMovieVector3,
): (point: IAutoMovieVector3) => IAutoMovieVector3 | null {
  const { forward, across, up } = contactFrame(direction, 0);
  const sample = createAutoMovieMeshDepthSampler(
    project(mesh, across, up, forward),
    "z",
  );
  return (point) => {
    if (![point.x, point.y, point.z].every(Number.isFinite))
      throw new Error("Directional intersection point must be finite.");
    const hit = sample(Vector3.dot(point, across), Vector3.dot(point, up));
    return hit === null
      ? null
      : advance(point, forward, hit.maximum - Vector3.dot(point, forward));
  };
}

/**
 * Contact against the actual resident surface along one declared direction.
 * Mesh, point and clearance use engine metres. A point behind the foremost hit
 * moves along the normalized direction to that hit plus nonnegative clearance.
 * An already clear point or a ray missing the surface returns the input object.
 *
 * The orthonormal frame turns arbitrary rays into the engine's depth query;
 * interpolation therefore uses the same mesh triangles as the rendered part.
 * This is directional contact, not a nearest-distance or global collision solver.
 * It preserves each point's projection onto the plane normal to the direction.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Keeps a point clear of its actual supporting mesh along one declared direction without moving its transverse projection.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Builds an orthonormal query frame, uses the foremost triangle hit and advances only points behind the required nonnegative clearance.
 */
export function createPortraitDirectionalContact(
  mesh: IAutoMovieMesh,
  direction: IAutoMovieVector3,
  clearance = 0,
): (point: IAutoMovieVector3) => IAutoMovieVector3 {
  const { forward, across, up } = contactFrame(direction, clearance);
  const sample = createAutoMovieMeshDepthSampler(
    project(mesh, across, up, forward),
    "z",
  );
  return (point) => {
    if (![point.x, point.y, point.z].every(Number.isFinite))
      throw new Error("Directional contact point must be finite.");
    const hit = sample(Vector3.dot(point, across), Vector3.dot(point, up));
    if (hit === null) return point;
    const distance = hit.maximum + clearance - Vector3.dot(point, forward);
    if (distance <= 0) return point;
    return advance(point, forward, distance);
  };
}

/**
 * Resolve complete triangle contact in the same frame as point contact. Each
 * offending face supplies its maximum required forward travel to all three
 * corners; a shared corner receives the maximum of its incident requirements.
 * Thus every interpolated point of that face advances at least its deficit.
 * The caller applies these metric targets through its shared skin adapter and
 * recomputes normals. This conservative construction preserves projected
 * topology; it does not decide anatomical thickness or fit quality.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Supplies shared-skin vertex targets that clear complete contacting triangles, not just sampled corners.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Measures front/back triangle clearance in a common directional frame and applies the maximum incident travel to each affected vertex.
 */
export function portraitDirectionalSurfaceTargets(
  front: IAutoMovieMesh,
  back: IAutoMovieMesh,
  direction: IAutoMovieVector3,
  clearance = 0,
): { vertex: number; target: IAutoMovieVector3 }[] {
  const { forward, across, up } = contactFrame(direction, clearance);
  const measured = measureAutoMovieMeshClearance(
    project(front, across, up, forward),
    project(back, across, up, forward),
    "z",
  );
  const indices =
    front.indices ??
    Array.from({ length: front.positions.length / 3 }, (_, i) => i);
  const travels = new Map<number, number>();
  for (const { triangle, minimum } of measured) {
    const distance = clearance - minimum;
    if (distance <= 0) continue;
    for (const vertex of indices.slice(triangle * 3, triangle * 3 + 3))
      travels.set(vertex, Math.max(travels.get(vertex) ?? 0, distance));
  }
  return [...travels].map(([vertex, distance]) => ({
    vertex,
    target: advance(
      Vector3.create(
        front.positions[vertex * 3],
        front.positions[vertex * 3 + 1],
        front.positions[vertex * 3 + 2],
      ),
      forward,
      distance,
    ),
  }));
}

function contactFrame(direction: IAutoMovieVector3, clearance: number) {
  if (
    ![direction.x, direction.y, direction.z, clearance].every(
      Number.isFinite,
    ) ||
    clearance < 0 ||
    Vector3.length(direction) === 0
  )
    throw new Error(
      "Directional contact needs a finite nonzero direction and nonnegative clearance.",
    );
  const forward = Vector3.normalize(direction);
  const guide =
    Math.abs(forward.y) < 0.9
      ? Vector3.create(0, 1, 0)
      : Vector3.create(1, 0, 0);
  const across = Vector3.normalize(Vector3.cross(guide, forward));
  const up = Vector3.cross(forward, across);
  return { forward, across, up };
}

function project(
  mesh: IAutoMovieMesh,
  across: IAutoMovieVector3,
  up: IAutoMovieVector3,
  forward: IAutoMovieVector3,
): IAutoMovieMesh {
  if (mesh.positions.length % 3 !== 0 || !mesh.positions.every(Number.isFinite))
    throw new Error(
      "Directional contact needs complete finite mesh positions.",
    );
  const positions: number[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const point = Vector3.create(
      mesh.positions[i],
      mesh.positions[i + 1],
      mesh.positions[i + 2],
    );
    positions.push(
      Vector3.dot(point, across),
      Vector3.dot(point, up),
      Vector3.dot(point, forward),
    );
  }
  return { ...mesh, positions, normals: null };
}

function advance(
  point: IAutoMovieVector3,
  forward: IAutoMovieVector3,
  distance: number,
): IAutoMovieVector3 {
  const result = Vector3.add(point, Vector3.scale(forward, distance));
  if (![result.x, result.y, result.z].every(Number.isFinite))
    throw new Error(
      "Directional contact exceeds its finite coordinate domain.",
    );
  return result;
}
