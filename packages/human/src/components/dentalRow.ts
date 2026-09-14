import {
  Vector3,
  mergeAutoMovieMeshes,
  separateAutoMovieMeshSequence,
} from "@automovie/engine";
import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

import { portraitPoint as p } from "../geometry/geometry";
import { createPortraitDentalArc } from "./dentalArc";
import {
  type IPortraitDentalCrown,
  assertPortraitDentalCrown,
  buildPortraitDentalCrown,
} from "./dentalCrown";

/**
 * One upper dental arch in a local millimetre frame. Individual crown profiles
 * describe enamel only; this group owns their spacing, curve and gingival plane.
 * +X runs across the arch, +Y towards the gingiva, +Z towards the lip. The arch's
 * anterior midpoint is the origin. These are authored portrait dimensions, not
 * a dental scan or a claim of physiological reconstruction.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates each ordered enamel crown from the arch dimensions, spacing and optional inter-crown clearance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines an elliptical maxillary guide and a shared gingival plane in millimetres; individual crowns retain independent profiles.
 */
export interface IPortraitDentalRow {
  /** Positive transverse semiaxis of the arch, in mm. */
  halfWidth: number;
  /** Positive anterior-to-posterior arch semiaxis, in mm. */
  depth: number;
  /** Nonnegative clearance measured along the common arch, in millimetres. */
  gap: number;
  /** Optional minimum inter-crown surface gap along local X, in mm. Omission retains nominal arch placement. */
  contactGap?: number;
  /** Ordered from anatomical right to left; each crown keeps its own dimensions. */
  crowns: readonly IPortraitDentalCrown[];
}

/**
 * Compose one resident enamel group before attaching it to the face. The local
 * guide is an ellipse: x=a*sin(theta), z=b*(cos(theta)-1), y=0. Its cumulative
 * arc length establishes nominal crown centres. The same tangent rotates each crown's
 * positions and normals, while all cervical ends share the group's Y=0 plane.
 * Neither a lip landmark's height nor an individual ray hit can tilt one tooth.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Places independent crowns along one dental arch without tilting each tooth to a lip landmark.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Samples an elliptical guide, rotates crown positions and normals together, and optionally separates their complete proximal surfaces.
 */
export function buildPortraitDentalRow(
  input: IPortraitDentalRow,
): IAutoMovieMesh {
  const shape = structuredClone(input);
  if (
    ![shape.halfWidth, shape.depth, shape.gap].every(Number.isFinite) ||
    shape.halfWidth <= 0 ||
    shape.depth <= 0 ||
    shape.gap < 0 ||
    shape.crowns.length === 0
  )
    throw new Error(
      "A dental row needs positive arch dimensions, a nonnegative gap and crowns.",
    );
  shape.crowns.forEach(assertPortraitDentalCrown);
  if (
    shape.contactGap !== undefined &&
    (!Number.isFinite(shape.contactGap) || shape.contactGap < 0)
  )
    throw new Error(
      "Dental surface contact gap must be finite and nonnegative.",
    );
  const crowns: IAutoMovieMesh[] = [];
  const length =
    shape.crowns.reduce((sum, crown) => sum + crown.width, 0) +
    shape.gap * (shape.crowns.length - 1);
  const guide = Array.from({ length: 33 }, (_v, i) => {
    const theta = Math.PI * (i / 32 - 0.5);
    return p(
      shape.halfWidth * Math.sin(theta),
      0,
      shape.depth * (Math.cos(theta) - 1),
    );
  });
  const arc = createPortraitDentalArc(guide, length);
  let cursor = arc.center - length / 2;
  for (let tooth = 0; tooth < shape.crowns.length; tooth++) {
    const profile = shape.crowns[tooth];
    const distance = cursor + profile.width / 2;
    const { position, tangent } = arc.sample(distance);
    // The proximal side toward the common arch midpoint is mesial. Resolve it
    // from arrangement, including unequal crown widths, instead of a tooth ID.
    const mesh = buildPortraitDentalCrown(
      profile,
      distance <= arc.center ? 1 : -1,
    );
    crowns.push(mesh);
    cursor += profile.width + shape.gap;
    // The tangent is the crown's local X axis. Its perpendicular in XZ is
    // the anterior normal; this orthonormal rotation preserves enamel width.
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i],
        z = mesh.positions[i + 2];
      mesh.positions[i] = position.x + tangent.x * x - tangent.z * z;
      mesh.positions[i + 1] -= profile.height / 2;
      mesh.positions[i + 2] = position.z + tangent.z * x + tangent.x * z;
      const nx = mesh.normals![i],
        nz = mesh.normals![i + 2];
      mesh.normals![i] = tangent.x * nx - tangent.z * nz;
      mesh.normals![i + 2] = tangent.z * nx + tangent.x * nz;
    }
  }
  // Arc-distance widths establish nominal centres but cannot account for the
  // rotated three-dimensional proximal faces. An optional complete-surface fit
  // shifts each intact crown along group X and balances the two end shifts. It
  // retains Y/Z, crown orientation and shape; the nominal ellipse is a guide,
  // not an exact locus after this explicitly requested contact adjustment.
  const placed =
    shape.contactGap === undefined
      ? crowns
      : separateAutoMovieMeshSequence(
          crowns.map((mesh) => ({
            ...mesh,
            positions: mesh.positions.map((value) => value / 1000),
          })),
          "x",
          shape.contactGap / 1000,
        ).map((mesh, index) => {
          const shift =
            (mesh.positions[0] - crowns[index].positions[0] / 1000) * 1000;
          return {
            ...mesh,
            positions: crowns[index].positions.map((value, axis) =>
              axis % 3 === 0 ? value + shift : value,
            ),
          };
        });
  return mergeAutoMovieMeshes(placed);
}

/**
 * Rigid placement shared by the entire upper row. The corner chord defines X;
 * the supplied upward guide is orthogonalized against it to define Y. Z=X cross
 * Y faces anteriorly. The origin is the central upper-lip reference, translated
 * once by the group's lift and recess. Corner points establish orientation,
 * never per-tooth positions or scaling. All points and offsets use millimetres.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Binds the complete enamel group through oral anchors and one rigid lift/recess frame.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines a corner chord, independent upward guide and upper-lip origin for a single millimetre attachment transform.
 */
export interface IPortraitDentalAttachment {
  /** Anatomical right oral corner in head millimetres. */
  rightCorner: IAutoMovieVector3;
  /** Anatomical left oral corner; its chord from the right defines local +X. */
  leftCorner: IAutoMovieVector3;
  /** Upper inner-lip midpoint supplying the arch's attachment origin. */
  upperLipMiddle: IAutoMovieVector3;
  /** Finite nonzero upward guide, independent of the corner chord. */
  up: IAutoMovieVector3;
  /** Signed upward placement from the upper-lip midpoint along the group's Y axis, in mm. */
  lift: number;
  /** Signed posterior placement from the upper-lip midpoint, in mm. */
  recess: number;
}

/**
 * Apply one orthonormal frame to every vertex and normal of the dental group.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Attaches all crowns as one intact enamel group rather than repositioning individual teeth.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Orthogonalizes the dental frame, transforms resident positions and normals together, and refuses degenerate or nonfinite placement.
 */
export function attachPortraitDentalRow(
  input: IAutoMovieMesh,
  attachment: IPortraitDentalAttachment,
): IAutoMovieMesh {
  const { rightCorner, leftCorner, upperLipMiddle, up, lift, recess } =
    attachment;
  if (
    ![rightCorner, leftCorner, upperLipMiddle, up].every((v) =>
      [v.x, v.y, v.z].every(Number.isFinite),
    ) ||
    ![lift, recess].every(Number.isFinite)
  )
    throw new Error("Dental attachment needs finite points and offsets.");
  const x = Vector3.normalize(Vector3.subtract(leftCorner, rightCorner));
  const y = Vector3.normalize(
    Vector3.subtract(up, Vector3.scale(x, Vector3.dot(up, x))),
  );
  const z = Vector3.cross(x, y);
  if (Vector3.length(x) === 0 || Vector3.length(y) === 0)
    throw new Error(
      "Dental attachment needs a nonzero chord and independent upward guide.",
    );
  const origin = Vector3.add(
    upperLipMiddle,
    Vector3.subtract(Vector3.scale(y, lift), Vector3.scale(z, recess)),
  );
  const mesh = structuredClone(input);
  if (mesh.normals === null || mesh.normals.length !== mesh.positions.length)
    throw new Error("Dental attachment needs aligned resident normals.");
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
    throw new Error("Dental attachment exceeds its representable range.");
  return mesh;
}
