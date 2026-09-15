import { Vector3 } from "@automovie/engine";
import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

/**
 * One orthonormal millimetre frame for a complete oral interior. Corners define
 * transverse X, the independent upward guide defines Y, and X cross Y faces
 * anteriorly. The supplied origin is shifted once by lift and posterior recess.
 * Corners orient the component; they never scale its authored dimensions.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Gives dental and lingual interiors the same explicit anatomical attachment convention.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Separates an oral component's local dimensions from its rigid origin and orientation.
 */
export interface IPortraitOralAttachment {
  /** Anatomical right oral corner in head millimetres. */
  rightCorner: IAutoMovieVector3;
  /** Anatomical left corner; the right-to-left chord establishes +X. */
  leftCorner: IAutoMovieVector3;
  /** Observed oral anchor, in head millimetres. */
  origin: IAutoMovieVector3;
  /** Finite nonzero upward guide independent of the corner chord. */
  up: IAutoMovieVector3;
  /** Signed superior displacement along the orthogonalized Y axis, in mm. */
  lift: number;
  /** Signed posterior displacement along the frame's Z axis, in mm. */
  recess: number;
}

/**
 * Place a resident oral mesh without changing its local distances. Positions
 * and normals use the same orthonormal frame; all returned buffers are owned.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Shares rigid oral placement across enamel and the independent tongue body.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Refuses degenerate frames, missing normals and nonfinite transformed buffers rather than publishing invalid anatomy.
 */
export function attachPortraitOralMesh(
  input: IAutoMovieMesh,
  attachment: IPortraitOralAttachment,
): IAutoMovieMesh {
  const {
    rightCorner,
    leftCorner,
    origin: anchor,
    up,
    lift,
    recess,
  } = attachment;
  if (
    ![rightCorner, leftCorner, anchor, up].every((v) =>
      [v.x, v.y, v.z].every(Number.isFinite),
    ) ||
    ![lift, recess].every(Number.isFinite)
  )
    throw new Error("Oral attachment needs finite points and offsets.");
  const x = Vector3.normalize(Vector3.subtract(leftCorner, rightCorner));
  const y = Vector3.normalize(
    Vector3.subtract(up, Vector3.scale(x, Vector3.dot(up, x))),
  );
  const z = Vector3.cross(x, y);
  if (Vector3.length(x) === 0 || Vector3.length(y) === 0)
    throw new Error(
      "Oral attachment needs a nonzero chord and independent upward guide.",
    );
  const origin = Vector3.add(
    anchor,
    Vector3.subtract(Vector3.scale(y, lift), Vector3.scale(z, recess)),
  );
  const mesh = structuredClone(input);
  if (mesh.normals === null || mesh.normals.length !== mesh.positions.length)
    throw new Error("Oral attachment needs aligned resident normals.");
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const point = [
        mesh.positions[i],
        mesh.positions[i + 1],
        mesh.positions[i + 2],
      ],
      normal = [mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]];
    for (const [a, key] of ["x", "y", "z"].entries()) {
      const axis = key as "x" | "y" | "z";
      mesh.positions[i + a] =
        origin[axis] +
        x[axis] * point[0] +
        y[axis] * point[1] +
        z[axis] * point[2];
      mesh.normals[i + a] =
        x[axis] * normal[0] + y[axis] * normal[1] + z[axis] * normal[2];
    }
  }
  if (![...mesh.positions, ...mesh.normals].every(Number.isFinite))
    throw new Error("Oral attachment exceeds its representable range.");
  return mesh;
}
