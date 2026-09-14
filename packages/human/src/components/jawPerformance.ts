import { Quaternion, Vector3 } from "@automovie/engine";
import type { IAutoMovieVector3 } from "@automovie/interface";

/**
 * Rotate mandibular tissue around an authored transverse hinge in head
 * millimetres. Positive rotation opens inferiorly for tissue anterior to the
 * hinge. A fixed weight is an attachment responsibility, not a muscle model;
 * angle times weight makes the corresponding inverse exactly the same motion.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Separates mandibular movement from fixed maxillary and optical anatomy.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Evaluates a bounded hinge rotation with explicit tissue attachment weights.
 */
export function posePortraitJawPoint(
  point: IAutoMovieVector3,
  hinge: IAutoMovieVector3,
  angle: number,
  weight: number,
): IAutoMovieVector3 {
  if (
    ![
      point.x,
      point.y,
      point.z,
      hinge.x,
      hinge.y,
      hinge.z,
      angle,
      weight,
    ].every(Number.isFinite) ||
    Math.abs(angle) > 25 ||
    weight < 0 ||
    weight > 1
  )
    throw new Error(
      "Jaw motion needs finite points, a signed angle in [-25,25] degrees and attachment weight in [0,1].",
    );
  if (angle === 0 || weight === 0) return { ...point };
  const result = Vector3.add(
    hinge,
    Quaternion.rotateVector(
      Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, angle * weight),
      Vector3.subtract(point, hinge),
    ),
  );
  if (![result.x, result.y, result.z].every(Number.isFinite))
    throw new Error("Jaw motion exceeds its finite coordinate domain.");
  return result;
}
