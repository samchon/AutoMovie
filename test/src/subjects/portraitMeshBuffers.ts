import {
  type IAutoMovieMeshTransform,
  Vector3,
  inspectAutoMovieMeshTopology,
  transformAutoMovieMesh,
} from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";

/**
 * Place each source face without losing it to a large translation's precision.
 * Each face also travels through the same engine transform in its own
 * translation-free frame: (0, b-a, c-a). This reference carries the intended
 * linear shape, scale and mirror winding without another TRS implementation.
 * It is validation data, never an exported second surface.
 *
 * Redundancy is classified after that linear scale. A sub-weld source edge can
 * become meaningful when enlarged, and must not then disappear merely because
 * its placed origin is huge. Conversely an intentionally shrunken redundant
 * pole follows the existing engine policy at its actual metric scale.
 */
export function placePortraitMesh(
  mesh: IAutoMovieMesh,
  transform: IAutoMovieMeshTransform,
): IAutoMovieMesh {
  const placed = transformAutoMovieMesh(mesh, transform);
  const sourceIndices =
    mesh.indices ??
    Array.from({ length: mesh.positions.length / 3 }, (_v, i) => i);
  const local: number[] = [];
  for (let face = 0; face < sourceIndices.length; face += 3) {
    const a = sourceIndices[face];
    local.push(0, 0, 0);
    for (const vertex of [sourceIndices[face + 1], sourceIndices[face + 2]])
      for (let axis = 0; axis < 3; axis++)
        local.push(
          mesh.positions[3 * vertex + axis] - mesh.positions[3 * a + axis],
        );
  }
  const reference = transformAutoMovieMesh(
    { positions: local, indices: null, normals: null, uvs: null, skin: null },
    { rotation: transform.rotation, scale: transform.scale },
  );
  const redundant = new Set(
    inspectAutoMovieMeshTopology(reference).degenerateTriangles,
  );
  for (let face = 0; face < placed.indices!.length; face += 3) {
    if (redundant.has(face / 3)) continue;
    assertDirection(
      triangleArea(reference.positions, reference.indices!, face),
      triangleArea(placed.positions, placed.indices!, face),
      face / 3,
      "placement",
    );
  }
  return placed;
}

/**
 * Materialize the actual glTF precision boundary and refuse new surface loss.
 * Positions and normals are Float32; resident triangle indices are Uint32.
 * The existing engine weld rule identifies source triangles already redundant
 * at a pole or seam. Preserve that policy by exact face identity, not by an
 * unchanged aggregate count that could hide one newly lost face behind another.
 *
 * Every other source triangle must keep a finite, nonzero oriented area after
 * quantization. Rounding is a representation conversion, not an authored turn,
 * so an output face opposing its source face is not an acceptable rotation.
 * No photograph, subject name, absolute area threshold or renderer verdict
 * exempts a face. All coordinates remain in the input's local metre frame.
 */
export function portraitMeshBuffers(mesh: IAutoMovieMesh): {
  positions: Float32Array;
  normals: Float32Array | null;
  indices: Uint32Array;
} {
  const topology = inspectAutoMovieMeshTopology(mesh);
  if (mesh.normals !== null && mesh.normals.length !== mesh.positions.length)
    throw new Error(
      "Portrait normal buffers must align with resident positions.",
    );
  const positions = new Float32Array(mesh.positions);
  const normals = mesh.normals === null ? null : new Float32Array(mesh.normals);
  const indices = new Uint32Array(
    mesh.indices ??
      Array.from({ length: mesh.positions.length / 3 }, (_v, i) => i),
  );
  if (
    !positions.every(Number.isFinite) ||
    (normals !== null && !normals.every(Number.isFinite))
  )
    throw new Error(
      "Portrait Float32 buffers must contain only finite components.",
    );
  if (normals !== null)
    for (let offset = 0; offset < normals.length; offset += 3) {
      // glTF NORMAL is a unit direction, including redundant-pole vertices.
      // One Float32 epsilon permits component rounding of an authored unit
      // vector; neither topology redundancy nor finite zero supplies direction.
      const length = Math.hypot(
        normals[offset],
        normals[offset + 1],
        normals[offset + 2],
      );
      if (Math.abs(length - 1) > 2 ** -23)
        throw new Error("Portrait GLTF NORMAL values must be unit directions.");
    }
  const redundant = new Set(topology.degenerateTriangles);
  for (let face = 0; face < indices.length; face += 3) {
    if (redundant.has(face / 3)) continue;
    assertDirection(
      triangleArea(mesh.positions, indices, face),
      triangleArea(positions, indices, face),
      face / 3,
      "Float32 conversion",
    );
  }
  return { positions, normals, indices };
}

function triangleArea(
  values: ArrayLike<number>,
  indices: ArrayLike<number>,
  face: number,
) {
  const point = (id: number) =>
    Vector3.create(values[3 * id], values[3 * id + 1], values[3 * id + 2]);
  const [a, b, c] = [indices[face], indices[face + 1], indices[face + 2]].map(
    point,
  );
  return Vector3.cross(Vector3.subtract(b, a), Vector3.subtract(c, a));
}

function assertDirection(
  before: { x: number; y: number; z: number },
  after: { x: number; y: number; z: number },
  face: number,
  stage: string,
): void {
  const beforeLength = Math.hypot(before.x, before.y, before.z);
  const afterLength = Math.hypot(after.x, after.y, after.z);
  const agreement =
    (before.x / beforeLength) * (after.x / afterLength) +
    (before.y / beforeLength) * (after.y / afterLength) +
    (before.z / beforeLength) * (after.z / afterLength);
  if (!(agreement > 0))
    throw new Error(
      `Portrait ${stage} must preserve nonredundant triangle ${face}.`,
    );
}
