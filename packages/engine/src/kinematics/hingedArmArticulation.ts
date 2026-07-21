import {
  IAutoMovieJointConstraint,
  IAutoMovieJointPose,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { validateJointRom } from "../rom/validateJointRom";
import { ViolationCollector } from "../validation/violation";
import { aimRotation } from "./aimRotation";
import { IAutoMovieChainBone } from "./twoBoneChainArticulation";

const RAD2DEG = 180 / Math.PI;

/**
 * Swivel resolution of the candidate sweep, in degrees.
 *
 * The sweep is a **bounded, deterministic enumeration**, not solver iteration:
 * every candidate lands the effector exactly on the target (see
 * {@link hingedArmArticulation}), so the step decides only which of the equally
 * exact poses is chosen, never how close the hand gets. One degree over the
 * circle is 360 candidates per bend branch, each a decompose plus a per-axis
 * ROM read and no forward kinematics, and the solve runs once per authored
 * action rather than per frame.
 */
const SWIVEL_STEP = 1;

/** Below this the mid joint cannot change the chain's span at all. */
const SPAN_EPSILON = 1e-9;

/** One scored candidate articulation. */
export interface IAutoMovieHingedArticulation {
  /** Bone-local articulation delta for the chain-root joint (the shoulder). */
  upper: IAutoMovieQuaternion;

  /**
   * Bone-local articulation delta for the mid joint (the elbow): a pure
   * rotation about that joint's own flexion axis, so its abduction and twist
   * decompose to exactly zero.
   */
  lower: IAutoMovieQuaternion;

  /**
   * Total ROM overshoot of the chosen candidate in degrees, `0` when the pose
   * satisfies both joints. Reported rather than hidden: a rig whose declared
   * ranges genuinely cannot hold any pose that reaches the target must still
   * say so, instead of the solver quietly returning its least-bad attempt as if
   * it were clean.
   */
  overshoot: number;
}

/**
 * Analytic two-bone arm IK that **respects the mid joint's hinge**.
 *
 * The predecessor ({@link twoBoneChainArticulation}) solves the mid joint as a
 * free swing, `aimRotation(localFore, localGoal)`, which generically decomposes
 * into abduction and twist. An elbow declares those axes immobile, so the pose
 * was illegal by construction, and the bend plane came from a world-down pole
 * that is right for a knee and bends an elbow backwards. On the canonical
 * humanoid under the engine's own default ROM table that combination produced a
 * ROM-violating pose for essentially every target, including targets where
 * valid poses provably exist (#1345).
 *
 * This solve inverts the split. The mid joint rotates **only** about its own
 * flexion axis, so its abduction and twist are zero by construction and the
 * bend plane is the hinge's own plane rather than a pole's guess. The interior
 * bend follows in closed form: writing the chain-root-to-effector span as a
 * function of the hinge angle `θ` gives
 *
 *     |m(θ)|² = k + α·cos θ + β·sin θ
 *
 * So `|m(θ)| = distance` is `R·cos(θ − φ) = distance² − k`, an arccos with the
 * chain's two bend branches as its two roots, and a target outside the span
 * clamps to the fully extended or fully folded end exactly as the
 * law-of-cosines solve did.
 *
 * The chain-root joint keeps the residual freedom, and that freedom is
 * **exact**: any extra rotation about `m(θ)` leaves the effector where it is,
 * so the whole swivel circle reaches the target. Spending it costs no accuracy,
 * which is why the candidates are scored on the rig's own ROM rather than on
 * residual. Among candidates the choice is lexicographic: legality first, then
 * the least articulation from the **anatomical neutral**. The angles are
 * clinical, so all-zero is "standing, arms at the sides", the same origin
 * `DEFAULT_HUMANOID_ROM` is written about, which makes a quadratic in those
 * degrees a least-effort posture prior stated in the convention's own terms
 * rather than an appeal to how a render looks.
 *
 * `R ≈ 0` means the hinge cannot change the span at all (it is parallel to the
 * far segment), the degeneracy {@link armChainFault} names; the solve returns
 * `null` rather than inventing a pose for a rig that has no reach shell.
 *
 * Returns `null` for a degenerate chain: a zero-length segment, a target
 * coincident with the chain root, or a hinge that cannot articulate the span.
 *
 * @author Samchon
 */
export const hingedArmArticulation = (props: {
  /** Resolved chain-root bone (the shoulder) under the rig's rest FK. */
  upper: IAutoMovieChainBone;

  /** Mid bone's rest offset from the chain root, in the root's bone frame. */
  midOffset: IAutoMovieVector3;

  /** Mid bone's rest rotation. */
  midRest: IAutoMovieQuaternion;

  /** Effector's rest offset from the mid joint, in the mid bone's frame. */
  endOffset: IAutoMovieVector3;

  /** The mid joint's flexion axis, in the mid bone's frame. */
  hinge: IAutoMovieVector3;

  /** World target the effector should land on. */
  target: IAutoMovieVector3;

  /**
   * Score one candidate's clinical angles, returning the total ROM overshoot in
   * degrees. The caller owns the decomposition convention (axes and rest
   * frames) and the rig's constraints, so this stays the geometry and never the
   * rig policy.
   */
  score: (
    upper: IAutoMovieQuaternion,
    lower: IAutoMovieQuaternion,
  ) => { overshoot: number; deviation: number };
}): IAutoMovieHingedArticulation | null => {
  const root = props.upper.worldPosition;
  const midOffset = props.midOffset;
  const endOffset = props.endOffset;
  if (Vector3.length(midOffset) < 1e-6 || Vector3.length(endOffset) < 1e-6)
    return null;

  const reach = Vector3.subtract(props.target, root);
  const distance = Vector3.length(reach);
  if (distance < 1e-6) return null;

  const hingeLength = Vector3.length(props.hinge);
  if (hingeLength < 1e-6) return null;
  const hinge = Vector3.scale(props.hinge, 1 / hingeLength);

  // |m(θ)|² = k + α cos θ + β sin θ, with the far segment split into the part
  // the hinge cannot move (along the hinge) and the part it swings.
  const along = Vector3.dot(hinge, endOffset);
  const swung = Vector3.subtract(endOffset, Vector3.scale(hinge, along));
  const radius = Vector3.length(swung);
  const rotated = (vector: IAutoMovieVector3): IAutoMovieVector3 =>
    Quaternion.rotateVector(props.midRest, vector);
  const k =
    Vector3.dot(midOffset, midOffset) +
    Vector3.dot(endOffset, endOffset) +
    2 * along * Vector3.dot(midOffset, rotated(hinge));
  let alpha = 0;
  let beta = 0;
  if (radius >= 1e-9) {
    const unit = Vector3.scale(swung, 1 / radius);
    alpha = 2 * radius * Vector3.dot(midOffset, rotated(unit));
    beta =
      2 * radius * Vector3.dot(midOffset, rotated(Vector3.cross(hinge, unit)));
  }
  const span = Math.hypot(alpha, beta);
  if (span < SPAN_EPSILON) return null;

  const phase = Math.atan2(beta, alpha);
  const ratio = (distance * distance - k) / span;
  // Outside the span the chain clamps to its extreme, so the effector stops on
  // the reachable shell pointing at the target rather than failing.
  const branches =
    ratio >= 1
      ? [phase]
      : ratio <= -1
        ? [phase + Math.PI]
        : [phase + Math.acos(ratio), phase - Math.acos(ratio)];

  const goal = Quaternion.rotateVector(
    Quaternion.inverse(props.upper.worldRotation),
    reach,
  );

  let best: (IAutoMovieHingedArticulation & { deviation: number }) | null =
    null;
  for (const theta of branches) {
    const lower = Quaternion.fromAxisAngle(hinge, theta * RAD2DEG);
    const mid = Vector3.add(
      midOffset,
      rotated(Quaternion.rotateVector(lower, endOffset)),
    );
    const aim = aimRotation(mid, goal);
    const swivelAxis = Vector3.normalize(mid);
    for (let step = 0; step * SWIVEL_STEP < 360; ++step) {
      const upper = Quaternion.multiply(
        aim,
        Quaternion.fromAxisAngle(swivelAxis, step * SWIVEL_STEP),
      );
      const { overshoot, deviation } = props.score(upper, lower);
      // Legality is compared EXACTLY, with no tolerance band. A band let a
      // candidate sitting one part in 1e12 outside a limit count as tied with a
      // strictly legal one and then win on deviation, so the solve returned a
      // pose the gate refuses by 1.5e-12 of a degree. The deviation prior pulls
      // toward the ROM box's edges, which is precisely where that happens, so
      // the ordering has to put "inside the box" ahead of "closer to neutral"
      // without qualification.
      if (
        best === null ||
        overshoot < best.overshoot ||
        (overshoot === best.overshoot && deviation < best.deviation)
      )
        best = { upper, lower, overshoot, deviation };
    }
  }
  // `branches` is never empty and the sweep always scores at least one
  // candidate, so `best` is assigned by here. Asserted rather than branched on:
  // a `null` arm would be dead code the coverage gate could never reach.
  const chosen = best!;
  return {
    upper: chosen.upper,
    lower: chosen.lower,
    overshoot: chosen.overshoot,
  };
};

/**
 * Total ROM overshoot of one joint's clinical angles in degrees, `0` when the
 * joint is clean. This is {@link validatePose}'s verdict reduced to a single
 * comparable number, taken through the same {@link validateJointRom} the gate
 * runs so the solver cannot grade itself by a kinder rule than the one that
 * will judge it.
 *
 * @author Samchon
 */
export const jointRomOvershoot = (
  joint: IAutoMovieJointPose,
  constraint: IAutoMovieJointConstraint | null,
): number => {
  if (constraint === null) return 0;
  const collector = new ViolationCollector();
  validateJointRom({ joint, constraint, path: "$candidate", collector });
  return collector.items.reduce(
    // A violation with no overshoot is not a free one. `validateJointRom` omits
    // the measure exactly when the angle is NOT FINITE, which is worse than any
    // distance past a limit and has no distance to report. Scoring it `0` would
    // rank a malformed candidate as perfectly legal and let it win the
    // selection outright, so it is scored as unusable instead.
    (total, item) => total + (item.overshoot ?? Number.POSITIVE_INFINITY),
    0,
  );
};

/** Squared clinical deviation from the anatomical neutral, in degrees². */
export const clinicalDeviation = (joint: {
  flexion: number;
  abduction: number;
  twist: number;
}): number =>
  joint.flexion * joint.flexion +
  joint.abduction * joint.abduction +
  joint.twist * joint.twist;
