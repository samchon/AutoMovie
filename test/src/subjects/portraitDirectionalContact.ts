import {
  Vector3,
  createAutoMovieMeshDepthSampler,
  measureAutoMovieMeshClearance,
} from "@automovie/engine";
import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

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
