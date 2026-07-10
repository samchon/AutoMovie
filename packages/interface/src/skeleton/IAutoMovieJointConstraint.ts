import { IAutoMovieAngleRange } from "./IAutoMovieAngleRange";

/**
 * The anatomical range of motion (ROM) of a single joint, decomposed into the
 * three clinical rotation axes.
 *
 * **This type is the heart of automovie's differentiator.** A bounded
 * blendshape vector prevents _out-of-range_ values, but nothing prevents a
 * _physically impossible_ joint angle (an elbow bending backward, a knee
 * hyper-extending) — which is exactly where raw LLM motion emission fails. By
 * attaching a `IAutoMovieJointConstraint` to each bone and validating poses
 * against it, automovie turns "is this pose anatomically possible?" into a
 * deterministic verifier, and lets the function-calling harness converge motion
 * the same way it converges JSON schemas: validate → `// ❌` → retry.
 *
 * A joint constrains only the axes it actually has. A hinge joint (elbow, knee)
 * sets `flexion` and leaves `abduction` / `twist` `null` (immobile on those
 * axes — any non-zero value there is rejected). A ball joint (shoulder, hip)
 * sets all three. `null` means "this axis does not move", which is _stronger_
 * than an empty range and distinct from "unconstrained".
 *
 * **Axis & sign conventions** (right-handed, clinical neutral = 0°):
 *
 * - `flexion` — sagittal plane. Positive = flexion (curl forward / bend the
 *   joint), negative = extension. e.g. elbow `[0, 150]` (no hyper-extension),
 *   knee `[0, 135]`, hip `[-30, 120]`.
 * - `abduction` — frontal plane. Positive = abduction (limb away from midline),
 *   negative = adduction. e.g. shoulder `[-50, 180]`.
 * - `twist` — transverse plane, axial rotation about the limb's long axis.
 *   Positive = external / lateral rotation, negative = internal / medial. e.g.
 *   shoulder `[-90, 90]`.
 *
 * The numeric tables live in `@automovie/engine` (sourced from goniometry
 * norms), not here — this type only describes their _shape_. Per-character
 * overrides are possible (a contortionist, a stylized non-human rig) by
 * supplying a different constraint on the bone.
 *
 * Reference: clinical goniometry / joint ROM norms (AAOS, Norkin & White,
 * _Measurement of Joint Motion_).
 *
 * @author Samchon
 */
export interface IAutoMovieJointConstraint {
  /**
   * Sagittal-plane range: flexion (+) / extension (−). `null` if the joint does
   * not flex/extend.
   */
  flexion: IAutoMovieAngleRange | null;

  /**
   * Frontal-plane range: abduction (+) / adduction (−). `null` for a pure hinge
   * joint that does not abduct/adduct.
   */
  abduction: IAutoMovieAngleRange | null;

  /**
   * Transverse-plane range: external (+) / internal (−) axial rotation. `null`
   * if the joint does not twist.
   */
  twist: IAutoMovieAngleRange | null;

  /**
   * Optional **swing cone** (degrees): a cap on the _combined_ flexion +
   * abduction, on top of the per-axis ranges. Per-axis boxes alone over-permit
   * a ball joint (shoulder, hip) — they let max flexion and max abduction
   * happen _at once_, a corner the real joint cannot reach. The cone bounds the
   * combined swing (`2·acos(cos(flexion/2)·cos(abduction/2))`) so the pose
   * stays inside the joint's true reachable sweep. `null`/omitted on hinges and
   * any joint that needs no combined cap (pure per-axis euler).
   *
   * The metric never exceeds 180°, so a 180° cone is pure HEADROOM, not a live
   * gate (#1058): a joint whose legitimate single-axis maximum is itself 180°
   * (the shoulder — arm straight overhead reaches swing 180 on one axis alone)
   * cannot carry a live cone without rejecting that canonical pose. The cone
   * only bites when set strictly below the per-axis maxima's combined reach, as
   * the hip's 120° is. Reference: joint sinus / reach-cone ROM models (Herda et
   * al.).
   */
  swingDeg?: number | null;
}
