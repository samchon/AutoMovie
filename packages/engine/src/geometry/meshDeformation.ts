import type {
  IAutoMovieMesh,
  IAutoMovieMeshDeformationField,
  IAutoMovieVector3,
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
 * A positive Jacobian at each vertex does not guarantee that the straight
 * triangles joining those samples remain valid. Each emitted triangle must
 * retain nonzero area and agree with its original face orientation transported
 * by the three vertex Jacobians. This is a tessellation check, not a global
 * self-intersection test or proof of the field between its sampled vertices.
 *
 * An optional influence sample supplies a scalar mask and its spatial gradient
 * at each resident vertex. For displacement d and mask f, the composed map is
 * p + f*d and its Jacobian is I + f*(J-I) + outer(d, gradient(f)). Gradients
 * use inverse metres in the same local frame. Apply an attachment mask here,
 * before orientation checks, rather than multiplying returned displacement
 * afterwards and silently invalidating the checked geometry. Mask samples are
 * caller-owned differential observations; the operation validates their shape
 * and finite domain, not their provenance or unsampled interpolation.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Applies composable spatial displacement and stretch fields to resident geometry without changing its triangle population.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves connectivity and shared normals through one analytic deformation, rejecting local folds instead of emitting inverted surface patches.
 * @evidence requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal Refuses malformed resident triangles and deformation output whose area collapses or opposes its transported face orientation.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Checks the actual emitted triangle population as well as vertex derivatives, naming a triangle that cannot preserve an oriented surface.
 * @author Samchon
 */
export function createAutoMovieMeshDeformer(
  fields: readonly IAutoMovieMeshDeformationField[],
): (
  mesh: IAutoMovieMesh,
  influence?: readonly { weight: number; gradient: IAutoMovieVector3 }[],
) => IAutoMovieMesh {
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
  return (mesh, influence) => {
    const indices =
      mesh.indices ??
      Array.from({ length: mesh.positions.length / 3 }, (_v, i) => i);
    if (
      mesh.positions.length % 3 !== 0 ||
      !mesh.positions.every(Number.isFinite) ||
      indices.length % 3 !== 0 ||
      indices.some(
        (index) =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= mesh.positions.length / 3,
      ) ||
      (mesh.normals !== null &&
        (mesh.normals.length !== mesh.positions.length ||
          !mesh.normals.every(Number.isFinite)))
    )
      throw new Error(
        "Mesh deformation needs finite complete positions, aligned normals and resident triangle indices.",
      );
    if (
      influence !== undefined &&
      (influence.length !== mesh.positions.length / 3 ||
        influence.some(
          ({ weight, gradient }) =>
            ![weight, gradient.x, gradient.y, gradient.z].every(
              Number.isFinite,
            ) ||
            weight < 0 ||
            weight > 1,
        ))
    )
      throw new Error(
        "Mesh influence needs one bounded weight and finite inverse-metre gradient per vertex.",
      );
    const positions: number[] = [];
    const normals: number[] | null = mesh.normals === null ? null : [];
    // Store the analytic cofactor matrix even when shading normals are absent.
    // Topological orientation belongs to each source face's winding, not to
    // smooth normals supplied by a caller or reconstructed from the result.
    const cofactors: number[][] = [];
    for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
      const point = mesh.positions.slice(vertex, vertex + 3);
      const target = [...point];
      const jacobian = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      for (const field of packed) {
        const dx = point[0] - field.center[0],
          dy = point[1] - field.center[1],
          dz = point[2] - field.center[2];
        // A compact field and its derivative are zero outside its support.
        // Reject the bounding box before allocating vectors or evaluating the
        // ellipsoid, since local anatomy affects only a small part of a mesh.
        if (
          Math.abs(dx) >= field.radius[0] ||
          Math.abs(dy) >= field.radius[1] ||
          Math.abs(dz) >= field.radius[2]
        )
          continue;
        const delta = [dx, dy, dz];
        const coordinates = delta.map(
          (value, axis) => value / field.radius[axis],
        );
        const squared = coordinates.reduce((sum, value) => sum + value ** 2, 0);
        if (squared >= 1) continue;
        const remaining = 1 - squared,
          weight = remaining ** 3;
        const derivative = -6 * remaining ** 2;
        for (let row = 0; row < 3; row++) {
          const movement =
            field.displacement[row] + field.stretch[row] * delta[row];
          target[row] += weight * movement;
          for (let column = 0; column < 3; column++)
            // Form movement*gradient(weight) as a dimensionless ratio. A
            // physical radius squared can underflow/overflow even when this
            // product is finite, including a neutral field's exact zero term.
            jacobian[row * 3 + column] +=
              derivative *
              ((movement * coordinates[column]) / field.radius[column]);
          jacobian[row * 3 + row] += weight * field.stretch[row];
        }
      }
      if (influence !== undefined) {
        const sample = influence[vertex / 3];
        const gradient = [
          sample.gradient.x,
          sample.gradient.y,
          sample.gradient.z,
        ];
        for (let row = 0; row < 3; row++) {
          const displacement = target[row] - point[row];
          target[row] = point[row] + sample.weight * displacement;
          for (let column = 0; column < 3; column++) {
            const identity = row === column ? 1 : 0;
            jacobian[3 * row + column] =
              identity +
              sample.weight * (jacobian[3 * row + column] - identity) +
              displacement * gradient[column];
          }
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
      cofactors.push([bc.x, ca.x, ab.x, bc.y, ca.y, ab.y, bc.z, ca.z, ab.z]);
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
    assertDeformedTriangles(mesh.positions, positions, indices, cofactors);
    return { ...mesh, positions, normals };
  };
}

/**
 * Compare a straight output face with the differential orientation of its
 * source face. Cofactors are det(J) * inverse(J)-transpose, so their positive
 * scalar does not alter orientation. Normalizing each transported face normal
 * before summation gives every corner equal weight, independent of local area
 * stretch. Comparing old and new area vectors directly would incorrectly
 * refuse an orientation-preserving bend that turns the face through 90 degrees.
 *
 * Cross products have square-metre units; normalized orientation is unitless.
 * No absolute area epsilon excludes a small but representable triangle. A
 * collapsed or opposing sampled face needs finer tessellation or a different
 * field, even when all of its endpoint Jacobians remain positive.
 */
function assertDeformedTriangles(
  source: readonly number[],
  target: readonly number[],
  indices: readonly number[],
  cofactors: readonly (readonly number[])[],
): void {
  const area = (
    positions: readonly number[],
    a: number,
    b: number,
    c: number,
  ) => {
    const ux = positions[3 * b] - positions[3 * a];
    const uy = positions[3 * b + 1] - positions[3 * a + 1];
    const uz = positions[3 * b + 2] - positions[3 * a + 2];
    const vx = positions[3 * c] - positions[3 * a];
    const vy = positions[3 * c + 1] - positions[3 * a + 1];
    const vz = positions[3 * c + 2] - positions[3 * a + 2];
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  };
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const vertices = indices.slice(triangle, triangle + 3);
    const before = area(source, vertices[0], vertices[1], vertices[2]);
    const after = area(target, vertices[0], vertices[1], vertices[2]);
    const beforeLength = Math.hypot(...before);
    const afterLength = Math.hypot(...after);
    if (
      !Number.isFinite(beforeLength) ||
      beforeLength === 0 ||
      !Number.isFinite(afterLength) ||
      afterLength === 0
    )
      throw new Error(
        `Mesh deformation triangle ${triangle / 3} needs finite nonzero source and output area.`,
      );
    const expected = [0, 0, 0];
    const normal = before.map((value) => value / beforeLength);
    for (const vertex of vertices) {
      const matrix = cofactors[vertex];
      const transported = [0, 1, 2].map(
        (row) =>
          matrix[3 * row] * normal[0] +
          matrix[3 * row + 1] * normal[1] +
          matrix[3 * row + 2] * normal[2],
      );
      const length = Math.hypot(...transported);
      for (let axis = 0; axis < 3; axis++)
        expected[axis] += transported[axis] / length;
    }
    const agreement = after.reduce(
      (sum, value, axis) => sum + (value / afterLength) * expected[axis],
      0,
    );
    if (!(agreement > 0))
      throw new Error(
        `Mesh deformation triangle ${triangle / 3} opposes its transported surface orientation.`,
      );
  }
}
