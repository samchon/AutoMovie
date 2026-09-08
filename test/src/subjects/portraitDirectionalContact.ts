import { Vector3, createAutoMovieMeshDepthSampler } from "@automovie/engine";
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
  if (mesh.positions.length % 3 !== 0 || !mesh.positions.every(Number.isFinite))
    throw new Error(
      "Directional contact needs complete finite mesh positions.",
    );
  const guide =
    Math.abs(forward.y) < 0.9
      ? Vector3.create(0, 1, 0)
      : Vector3.create(1, 0, 0);
  const across = Vector3.normalize(Vector3.cross(guide, forward));
  const up = Vector3.cross(forward, across);
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
  const sample = createAutoMovieMeshDepthSampler(
    { ...mesh, positions, normals: null },
    "z",
  );
  return (point) => {
    if (![point.x, point.y, point.z].every(Number.isFinite))
      throw new Error("Directional contact point must be finite.");
    const hit = sample(Vector3.dot(point, across), Vector3.dot(point, up));
    if (hit === null) return point;
    const distance = hit.maximum + clearance - Vector3.dot(point, forward);
    if (distance <= 0) return point;
    const result = Vector3.add(point, Vector3.scale(forward, distance));
    if (![result.x, result.y, result.z].every(Number.isFinite))
      throw new Error(
        "Directional contact exceeds its finite coordinate domain.",
      );
    return result;
  };
}
