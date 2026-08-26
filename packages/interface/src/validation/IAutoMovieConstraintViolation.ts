import { AutoMovieViolationKind } from "./AutoMovieViolationKind";

/**
 * One deterministic constraint violation: the unit of feedback a direct
 * authoring caller or build boundary turns into a located correction.
 *
 * This is automovie's domain-level analogue of typia's `IValidation.IError`,
 * enriched with a {@link AutoMovieViolationKind} (so failures route to the right
 * tier/corrector) and a human-and-LLM-readable `expected` string. The engine
 * emits these from its ROM / physics / temporal verifiers at the offending JSON
 * path. A direct caller consumes them as data, and the same objects cross every
 * boundary that carries a refusal outward, so both
 * direct and remote callers see exactly what was wrong and fix only that field.
 * This object _is_ how a rejected fact or a physics warning becomes an
 * actionable signal rather than a silent failure.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `IAutoMovieConstraintViolation` as the portable data boundary for the diagnostics correction and recheck requirement.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `IAutoMovieConstraintViolation` for the validation diagnostic correction revalidation system contract.
 * @author Samchon
 */
export interface IAutoMovieConstraintViolation {
  /**
   * Which tier/category failed; routes the correction.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `kind` as the portable data boundary for the diagnostics correction and recheck requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `kind` for the validation diagnostic correction revalidation system contract.
   */
  kind: AutoMovieViolationKind;

  /**
   * How binding this feedback is. `"error"` is a rig/render-integrity breach (a
   * disconnected skeleton, a non-finite quaternion, a negative duration, an
   * out-of-range coefficient) and fails validation. `"warning"` is
   * physical-plausibility advice (a body that would topple, an unsupported mass
   * that would fall): recommended, not forbidden, because a film may be
   * deliberately unphysical. A `"warning"` never fails validation on its own;
   * it rides the same envelope so the build can surface it and the author (or
   * an action's `physicsIntent` marker) can accept or dismiss it. `"warning"`
   * is the compiler's word for this level, not "advisory".
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `severity` as the portable data boundary for the diagnostics correction and recheck requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `severity` for the validation diagnostic correction revalidation system contract.
   */
  severity: "error" | "warning";

  /**
   * JSON path to the offending value, in typia's `$input...` notation (e.g.
   * `$input.joints[3].flexion`). This is the anchor the `// ❌` comment attaches
   * to.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `path` as the portable data boundary for the diagnostics correction and recheck requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `path` for the validation diagnostic correction revalidation system contract.
   */
  path: string;

  /**
   * Human / LLM readable statement of what was required, precise enough to act
   * on (e.g. `"leftLowerArm flexion must be within [0, 150]° (anatomical ROM),
   * but was 175"`).
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `expected` as the portable data boundary for the diagnostics correction and recheck requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `expected` for the validation diagnostic correction revalidation system contract.
   */
  expected: string;

  /**
   * The actual offending value, carried verbatim for the feedback comment.
   * `unknown` because a violation can occur at any field type; this is the one
   * deliberate `unknown` at the validation boundary.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `value` as the portable data boundary for the diagnostics correction and recheck requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `value` for the validation diagnostic correction revalidation system contract.
   */
  value: unknown;

  /**
   * Signed magnitude by which the value missed the bound, in the channel's own
   * unit (degrees for ROM): how far _past_ the limit it sat (an elbow at 175°
   * against a 150° max → `25`). Present only for numeric overshoots; lets a
   * corrector judge severity (a 2° graze vs a 90° break) and the `// ❌` comment
   * quote the gap. Absent for non-numeric or non-magnitude violations.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `overshoot` as the portable data boundary for the diagnostics correction and recheck requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `overshoot` for the validation diagnostic correction revalidation system contract.
   */
  overshoot?: number;

  /**
   * Id of the screenplay refinement-graph node ({@link IAutoMovieScriptNode})
   * this feedback locates on, usually the beat node whose work produced it.
   * With the node in hand, `scriptAncestors` walks the refinement chain up
   * (beat → scene → act → intent), so a physics warning can cascade past the
   * motion into the screenplay itself: the correction may target the pose, the
   * beat's staging, or the scene's intent; the agent decides which level to
   * fix. Absent when no screenplay tree exists or the feedback is not
   * beat-scoped.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `node` as the portable data boundary for the diagnostics correction and recheck requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `node` for the validation diagnostic correction revalidation system contract.
   */
  node?: string;
}
