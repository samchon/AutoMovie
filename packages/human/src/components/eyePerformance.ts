import { Quaternion, Vector3 } from "@automovie/engine";
import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

import type { IPortraitEyeSphere } from "../geometry/portraitEyeSphere";

/**
 * Eye performance relative to the recorded aperture. Optical curvature and
 * radius remain identity values; gaze rotates the actual optical surfaces.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Separates eyelid closure and gaze from the optical identity dimensions.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Carries observed closure and current performance without refitting the globe.
 * @author Samchon
 */
export interface IPortraitEyePerformance {
  /** Current closure in [0,1]; one brings the two margins to a common seam. */
  blink: number;
  /** Closure already in the observed aperture, in [0,0.95]; a fully hidden aperture cannot determine its neutral height. */
  observedBlink: number;
  /** Gaze yaw difference from the observation, in [-50,50] degrees; positive turns towards +X. */
  yaw: number;
  /** Gaze pitch difference from the observation, in [-40,40] degrees; positive turns upwards. */
  pitch: number;
}

/**
 * Admit eye performance independently of a mesh or an editor's slider ranges.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Refuses unsupported closure and gaze inputs before constructing posed tissues.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Keeps observed closure invertible and current performance finite.
 */
export function assertPortraitEyePerformance(
  input: IPortraitEyePerformance,
): void {
  if (
    ![input.blink, input.observedBlink, input.yaw, input.pitch].every(
      Number.isFinite,
    ) ||
    input.blink < 0 ||
    input.blink > 1 ||
    input.observedBlink < 0 ||
    input.observedBlink > 0.95 ||
    Math.abs(input.yaw) > 50 ||
    Math.abs(input.pitch) > 40
  )
    throw new Error(
      "Eye performance needs finite closure and supported gaze differences; a fully closed observation cannot define neutral lids.",
    );
}

/**
 * Move paired lid margins towards one shared seam without changing their
 * identity sphere. The upper margin supplies three quarters of closure travel;
 * the lower supplies one quarter. These are explicit authoring kinematics, not
 * a simulation of individual muscle fibres. The outer skin guide stays separate.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Evaluates open, closed and observed-relative lid movement on one anatomical boundary.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Changes aperture visibility independently of optical dimensions.
 */
export function posePortraitLidCurves(
  upper: readonly IAutoMovieVector3[],
  lower: readonly IAutoMovieVector3[],
  performance: IPortraitEyePerformance,
): { upper: IAutoMovieVector3[]; lower: IAutoMovieVector3[] } {
  assertPortraitEyePerformance(performance);
  if (
    upper.length < 3 ||
    lower.length !== upper.length ||
    [...upper, ...lower].some(
      (point) => ![point.x, point.y, point.z].every(Number.isFinite),
    )
  )
    throw new Error(
      "Animated eyelids need paired finite anatomical margin samples.",
    );
  if (performance.blink === performance.observedBlink)
    return {
      upper: structuredClone([...upper]),
      lower: structuredClone([...lower]),
    };
  const ratio = (1 - performance.blink) / (1 - performance.observedBlink);
  const seam = upper.map((point, i) =>
    Vector3.add(Vector3.scale(point, 0.25), Vector3.scale(lower[i], 0.75)),
  );
  const move = (points: readonly IAutoMovieVector3[]) =>
    points.map((point, i) =>
      Vector3.add(
        seam[i],
        Vector3.scale(Vector3.subtract(point, seam[i]), ratio),
      ),
    );
  const result = { upper: move(upper), lower: move(lower) };
  if (
    [...result.upper, ...result.lower].some(
      (point) => ![point.x, point.y, point.z].every(Number.isFinite),
    )
  )
    throw new Error(
      "Eyelid motion exceeds representable construction coordinates.",
    );
  return result;
}

/**
 * Rotate an optical mesh about its unchanged globe centre. All distances use
 * the mesh's construction millimetres, while normals receive rotation only.
 * A zero gaze difference preserves every number rather than renormalizing it.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Rotates iris and corneal geometry for gaze without changing their size or thickness.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Applies one rigid optical transform shared by drawing and contact.
 */
export function posePortraitOpticalMesh(
  input: IAutoMovieMesh,
  center: IAutoMovieVector3,
  performance: IPortraitEyePerformance,
): IAutoMovieMesh {
  assertPortraitEyePerformance(performance);
  if (
    ![center.x, center.y, center.z, ...input.positions].every(
      Number.isFinite,
    ) ||
    input.positions.length % 3 !== 0 ||
    (input.normals !== null &&
      (input.normals.length !== input.positions.length ||
        !input.normals.every(Number.isFinite)))
  )
    throw new Error(
      "Optical rotation needs a finite centre and aligned position/normal triples.",
    );
  const mesh = structuredClone(input);
  if (performance.yaw === 0 && performance.pitch === 0) return mesh;
  const rotation = Quaternion.multiply(
    Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, performance.yaw),
    Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, -performance.pitch),
  );
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const point = Vector3.create(
      mesh.positions[i],
      mesh.positions[i + 1],
      mesh.positions[i + 2],
    );
    const placed = Vector3.add(
      center,
      Quaternion.rotateVector(rotation, Vector3.subtract(point, center)),
    );
    mesh.positions.splice(i, 3, placed.x, placed.y, placed.z);
  }
  if (mesh.normals !== null)
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const normal = Quaternion.rotateVector(
        rotation,
        Vector3.create(
          mesh.normals[i],
          mesh.normals[i + 1],
          mesh.normals[i + 2],
        ),
      );
      mesh.normals.splice(i, 3, normal.x, normal.y, normal.z);
    }
  if (
    !mesh.positions.every(Number.isFinite) ||
    (mesh.normals !== null && !mesh.normals.every(Number.isFinite))
  )
    throw new Error(
      "Optical rotation exceeds representable coordinates or normals.",
    );
  return mesh;
}

/**
 * Construct one complete globe independent of eyelid visibility. Single pole
 * vertices and wrapped ring indices avoid collapsed rectangular pole cells.
 * The surrounding opaque tissues, not a changing optical mesh, hide the globe.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Keeps a resident optical identity under animated eyelids.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Does not shrink or refit the globe as the aperture closes.
 */
export function buildPortraitPerformanceGlobe(
  sphere: IPortraitEyeSphere,
  columns: number,
  rows: number,
): IAutoMovieMesh {
  if (
    ![sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius].every(
      Number.isFinite,
    ) ||
    sphere.radius <= 0 ||
    !Number.isInteger(columns) ||
    columns < 3 ||
    columns > 512 ||
    !Number.isInteger(rows) ||
    rows < 2 ||
    rows > 512
  )
    throw new Error(
      "A performance globe needs a finite positive sphere and bounded integer sampling.",
    );
  const normals = [0, 1, 0];
  const indices: number[] = [];
  for (let row = 1; row < rows; row++) {
    const latitude = (Math.PI * row) / rows;
    for (let column = 0; column < columns; column++) {
      const longitude = (2 * Math.PI * column) / columns;
      normals.push(
        Math.sin(latitude) * Math.cos(longitude),
        Math.cos(latitude),
        Math.sin(latitude) * Math.sin(longitude),
      );
    }
  }
  const south = normals.length / 3;
  normals.push(0, -1, 0);
  for (let column = 0; column < columns; column++) {
    const next = (column + 1) % columns;
    indices.push(0, 1 + next, 1 + column);
    for (let row = 0; row < rows - 2; row++) {
      const a = 1 + row * columns + column,
        b = 1 + row * columns + next;
      indices.push(a, b, a + columns, b, b + columns, a + columns);
    }
    const last = 1 + (rows - 2) * columns;
    indices.push(last + column, last + next, south);
  }
  const center = [sphere.center.x, sphere.center.y, sphere.center.z];
  const positions = normals.map(
    (value, axis) => center[axis % 3] + sphere.radius * value,
  );
  if (!positions.every(Number.isFinite))
    throw new Error(
      "Globe placement exceeds representable construction coordinates.",
    );
  return { positions, normals, indices, uvs: null, skin: null };
}
