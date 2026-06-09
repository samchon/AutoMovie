import { IAutoFilmAngleRange } from "./IAutoFilmAngleRange";

/**
 * The anatomical range of motion (ROM) of a single joint, decomposed into the
 * three clinical rotation axes.
 *
 * **This type is the heart of autofilm's differentiator.** A bounded blendshape
 * vector prevents _out-of-range_ values, but nothing prevents a _physically
 * impossible_ joint angle (an elbow bending backward, a knee hyper-extending) —
 * which is exactly where raw LLM motion emission fails. By attaching a
 * `IAutoFilmJointConstraint` to each bone and validating poses against it,
 * autofilm turns "is this pose anatomically possible?" into a deterministic
 * verifier, and lets the function-calling harness converge motion the same way
 * it converges JSON schemas: validate → `// ❌` → retry.
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
 * The numeric tables live in `@autofilm/engine` (sourced from goniometry
 * norms), not here — this type only describes their _shape_. Per-character
 * overrides are possible (a contortionist, a stylized non-human rig) by
 * supplying a different constraint on the bone.
 *
 * Reference: clinical goniometry / joint ROM norms (AAOS, Norkin & White,
 * _Measurement of Joint Motion_).
 *
 * @author Samchon
 */
export interface IAutoFilmJointConstraint {
  /**
   * Sagittal-plane range: flexion (+) / extension (−). `null` if the joint does
   * not flex/extend.
   */
  flexion: IAutoFilmAngleRange | null;

  /**
   * Frontal-plane range: abduction (+) / adduction (−). `null` for a pure hinge
   * joint that does not abduct/adduct.
   */
  abduction: IAutoFilmAngleRange | null;

  /**
   * Transverse-plane range: external (+) / internal (−) axial rotation. `null`
   * if the joint does not twist.
   */
  twist: IAutoFilmAngleRange | null;
}
