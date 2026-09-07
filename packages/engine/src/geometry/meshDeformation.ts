import type {
  IAutoMovieMesh,
  IAutoMovieMeshDeformationField,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";

/**
 * Compile immutable compact deformation fields into a mesh operation. Every
 * position uses the same summed field, and normals use its analytic inverse
 * transpose. Splitting one skin into material regions therefore cannot create
 * a new lighting seam. UVs, triangle identities and skin bindings are retained.
 *
 * Influence is (1-r²)^3 inside the normalized ellipsoid and zero outside.
 * Nonfinite fields, nonpositive radii and local orientation reversal are refused.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Applies composable spatial displacement and stretch fields to resident geometry without changing its triangle population.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves connectivity and shared normals through one analytic deformation, rejecting local folds instead of emitting inverted surface patches.
 * @author Samchon
 */
export function createAutoMovieMeshDeformer(
  fields: readonly IAutoMovieMeshDeformationField[],
): (mesh: IAutoMovieMesh) => IAutoMovieMesh {
  const packed = fields.map((field) => {
    const vector = (value: { x: number; y: number; z: number }): number[] => [
      value.x,
      value.y,
      value.z,
    ];
    const center = vector(field.center),
      radius = vector(field.radius),
      displacement = vector(field.displacement),
      stretch = vector(field.stretch);
    if (
      ![...center, ...radius, ...displacement, ...stretch].every(
        Number.isFinite,
      ) ||
      radius.some((value) => value <= 0)
    )
      throw new Error(
        "Mesh deformation fields need finite vectors and strictly positive radii.",
      );
    return { center, radius, displacement, stretch };
  });
  return (mesh) => {
    const positions: number[] = [];
    const normals: number[] | null = mesh.normals === null ? null : [];
    for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
      const point = mesh.positions.slice(vertex, vertex + 3);
      const target = [...point];
      const jacobian = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      for (const field of packed) {
        const delta = point.map((value, axis) => value - field.center[axis]);
        const squared = delta.reduce(
          (sum, value, axis) => sum + (value / field.radius[axis]) ** 2,
          0,
        );
        if (squared >= 1) continue;
        const remaining = 1 - squared,
          weight = remaining ** 3;
        const gradient = delta.map(
          (value, axis) =>
            (-6 * remaining ** 2 * value) / field.radius[axis] ** 2,
        );
        for (let row = 0; row < 3; row++) {
          const movement =
            field.displacement[row] + field.stretch[row] * delta[row];
          target[row] += weight * movement;
          for (let column = 0; column < 3; column++)
            jacobian[row * 3 + column] += movement * gradient[column];
          jacobian[row * 3 + row] += weight * field.stretch[row];
        }
      }
      const a = Vector3.create(jacobian[0], jacobian[3], jacobian[6]);
      const b = Vector3.create(jacobian[1], jacobian[4], jacobian[7]);
      const c = Vector3.create(jacobian[2], jacobian[5], jacobian[8]);
      const bc = Vector3.cross(b, c),
        ca = Vector3.cross(c, a),
        ab = Vector3.cross(a, b);
      const determinant = Vector3.dot(a, bc);
      if (
        !Number.isFinite(determinant) ||
        determinant <= 0 ||
        !target.every(Number.isFinite)
      )
        throw new Error(
          "Mesh deformation must remain finite and preserve local surface orientation.",
        );
      positions.push(...target);
      if (normals !== null) {
        const normal = Vector3.normalize(
          Vector3.add(
            Vector3.add(
              Vector3.scale(bc, mesh.normals![vertex]),
              Vector3.scale(ca, mesh.normals![vertex + 1]),
            ),
            Vector3.scale(ab, mesh.normals![vertex + 2]),
          ),
        );
        normals.push(normal.x, normal.y, normal.z);
      }
    }
    return { ...mesh, positions, normals };
  };
}
