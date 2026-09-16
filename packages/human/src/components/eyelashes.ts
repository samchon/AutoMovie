import { Quaternion, Vector3 } from "@automovie/engine";
import type {
  IAutoMovieMesh,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { portraitPatch } from "../geometry/geometry";

/**
 * A curved upper lash rooted on the current lid margin. Length is the maximum
 * centreline arc length, not its image-plane height or anterior projection.
 * Angles belong to the observed head frame. Lid performance carries the root
 * and transports the strand by the change in its globe-relative direction.
 * This rigid attachment does not simulate individual-hair dynamics.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates lash length, launch, curl, lateral fan and fibre cross-section from the aperture.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines a bounded numerical strand profile attached to the final upper margin.
 */
export interface IPortraitEyelashProfile {
  /** Maximum centreline arc length in [0.1,20] mm; canthal and growth weights shorten individual lashes. */
  length: number;
  /** Observed initial tangent elevation from anterior +Z towards superior +Y, in [-75,75] degrees; lid motion transports this direction. */
  elevation: number;
  /** Signed tangent turn from root to tip in [-60,120] degrees; positive curls upwards. */
  curl: number;
  /** Medial-to-lateral fan span in [0,90] degrees; opposite eyes mirror its head-X direction. */
  fan: number;
  /** Root radius in [0.005,0.2] mm. */
  radius: number;
  /** Fraction of root radius removed at the tip in [0,0.98]; the tip remains nonzero. */
  taper: number;
  /** Maximum deterministic per-strand length reduction in [0,0.5]. */
  variation: number;
}

/**
 * Shared shape admission and editor envelopes. These are authoring bounds,
 * not measured population limits; the caller supplies each chosen value.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Gives each lash axis a unit and bounded editing meaning.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Shares one scalar envelope between geometry admission and the detail editor.
 */
export const portraitEyelashParameters = [
  {
    id: "length",
    minimum: 0.1,
    maximum: 20,
    step: 0.1,
    unit: "mm",
    meaning: "Maximum upper-lash arc length",
    effect:
      "Increasing lengthens the curved strand without enlarging the eye aperture.",
  },
  {
    id: "elevation",
    minimum: -75,
    maximum: 75,
    step: 1,
    unit: "degrees",
    meaning: "Upper-lash root elevation",
    effect:
      "Increasing tilts the initial tangent upwards from the head's anterior axis.",
  },
  {
    id: "curl",
    minimum: -60,
    maximum: 120,
    step: 1,
    unit: "degrees",
    meaning: "Upper-lash root-to-tip curl",
    effect:
      "Increasing turns the strand upwards while preserving its arc length.",
  },
  {
    id: "fan",
    minimum: 0,
    maximum: 90,
    step: 1,
    unit: "degrees",
    meaning: "Upper-lash lateral fan",
    effect:
      "Increasing spreads medial and lateral strands away from the central anterior direction.",
  },
  {
    id: "radius",
    minimum: 0.005,
    maximum: 0.2,
    step: 0.005,
    unit: "mm",
    meaning: "Upper-lash root radius",
    effect: "Increasing thickens the strand without changing its centreline.",
  },
  {
    id: "taper",
    minimum: 0,
    maximum: 0.98,
    step: 0.01,
    unit: "ratio",
    meaning: "Upper-lash tip thinning",
    effect: "Increasing reduces tip radius relative to the fixed root radius.",
  },
  {
    id: "variation",
    minimum: 0,
    maximum: 0.5,
    step: 0.01,
    unit: "ratio",
    meaning: "Upper-lash length variation",
    effect:
      "Increasing shortens selected strands by a deterministic fraction, independent of editing order.",
  },
] as const;

/**
 * Refuse incomplete, nonfinite or out-of-envelope lash profiles before an eye
 * allocates its geometry. Empty objects are not an implicit new hairstyle.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Admits the complete named lash profile separately from eyelid dimensions.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Refuses unsupported profile values before strand construction.
 */
export function assertPortraitEyelashProfile(
  profile: IPortraitEyelashProfile,
): void {
  for (const parameter of portraitEyelashParameters) {
    const value = profile[parameter.id];
    if (
      !Number.isFinite(value) ||
      value < parameter.minimum ||
      value > parameter.maximum
    )
      throw new Error(
        `Upper-lash ${parameter.id} must be finite in [${parameter.minimum},${parameter.maximum}] ${parameter.unit}.`,
      );
  }
}

/**
 * Sweep one constant-curvature lash with a frame that stays defined for a
 * straight anterior strand. The arc integral uses sinc at zero, so straight
 * and arbitrarily shallow curls do not divide by a tiny turn angle.
 * Optional motion supplies observed and current globe-to-lid directions in
 * the same frame. Their shortest rotation acts about the current root, without
 * changing length or radius. Antipodal directions have no unique transport.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Builds a numerical lash from its current margin root without reshaping skin or optics.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Preserves arc length under signed curl and mirrors the fan with anatomical side.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Carries the strand orientation with lid motion while leaving its current root fixed.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Applies observed-relative rigid radial transport independently of gaze and optical geometry.
 */
export function buildPortraitEyelash(
  origin: IAutoMovieVector3,
  profile: IPortraitEyelashProfile,
  side: "right" | "left",
  at: number,
  index: number,
  motion?: { from: IAutoMovieVector3; to: IAutoMovieVector3 },
): IAutoMovieMesh {
  assertPortraitEyelashProfile(profile);
  if (
    ![origin.x, origin.y, origin.z, at].every(Number.isFinite) ||
    at < 0 ||
    at > 1 ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    (side !== "left" && side !== "right")
  )
    throw new Error(
      "A lash needs a finite root, anatomical side, unit progress and nonnegative safe strand index.",
    );
  const radians = Math.PI / 180;
  const length =
    profile.length *
    (0.45 + 0.55 * Math.sin(Math.PI * at) ** 0.7) *
    (1 - profile.variation * Math.cos(index * 2.4) ** 2);
  const initial = profile.elevation * radians;
  const curl = profile.curl * radians;
  if (profile.radius * Math.abs(curl) >= length)
    throw new Error(
      "A lash radius must stay below its centreline curvature radius.",
    );
  const fan = (side === "left" ? 1 : -1) * (at - 0.45) * profile.fan * radians;
  const sinFan = Math.sin(fan),
    cosFan = Math.cos(fan);
  let rotation: IAutoMovieQuaternion | undefined;
  if (motion !== undefined) {
    const directions = [motion.from, motion.to].map((value) => {
      const size = Math.hypot(value.x, value.y, value.z);
      if (!Number.isFinite(size) || size === 0)
        throw new Error(
          "Lash transport needs finite nonzero radial directions.",
        );
      return { x: value.x / size, y: value.y / size, z: value.z / size };
    });
    const cross = Vector3.cross(directions[0], directions[1]);
    const sine = Vector3.length(cross),
      cosine = Vector3.dot(directions[0], directions[1]);
    if (sine === 0 && cosine < 0)
      throw new Error("Antipodal lash directions have no unique transport.");
    if (sine !== 0)
      rotation = Quaternion.fromAxisAngle(
        cross,
        (Math.atan2(sine, cosine) * 180) / Math.PI,
      );
  }
  return portraitPatch(
    (u, t) => {
      const half = (curl * t) / 2;
      const distance = length * t * (half === 0 ? 1 : Math.sin(half) / half);
      const forward = distance * Math.cos(initial + half);
      const upward = distance * Math.sin(initial + half);
      const angle = initial + curl * t;
      const radius = profile.radius * (1 - profile.taper * t);
      const a = radius * Math.cos(2 * Math.PI * u);
      const b = radius * Math.sin(2 * Math.PI * u);
      const offset = {
        x: sinFan * forward + cosFan * a - sinFan * Math.sin(angle) * b,
        y: upward + Math.cos(angle) * b,
        z: cosFan * forward - sinFan * a - cosFan * Math.sin(angle) * b,
      };
      return Vector3.add(
        origin,
        rotation === undefined
          ? offset
          : Quaternion.rotateVector(rotation, offset),
      );
    },
    8,
    12,
  );
}
