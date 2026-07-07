import { AutoMovieViolationKind } from "./AutoMovieViolationKind";

/**
 * One deterministic constraint violation — the unit of feedback the harness
 * turns into a `// ❌` correction comment.
 *
 * This is automovie's domain-level analogue of typia's `IValidation.IError`,
 * enriched with a {@link AutoMovieViolationKind} (so failures route to the right
 * tier/corrector) and a human-and-LLM-readable `expected` string. The engine
 * emits these from its ROM / physics / temporal verifiers; `@automovie/agent`
 * lowers them onto the offending JSON path so the model sees exactly what was
 * wrong on its own output and fixes only that field. This object _is_ how
 * "physically impossible poses are rejected" becomes an actionable signal
 * rather than a silent failure.
 *
 * @author Samchon
 */
export interface IAutoMovieConstraintViolation {
  /** Which tier/category failed — routes the correction. */
  kind: AutoMovieViolationKind;

  /**
   * How binding this feedback is. `"error"` is a rig/render-integrity breach —
   * a disconnected skeleton, a non-finite quaternion, a negative duration, an
   * out-of-range coefficient — and fails validation. `"warning"` is
   * physical-plausibility advice (a body that would topple, an unsupported mass
   * that would fall): recommended, not forbidden, because a film may be
   * deliberately unphysical. A `"warning"` never fails validation on its own;
   * it rides the same envelope so the harness can surface it and the author (or
   * an action's `physicsIntent` marker) can accept or dismiss it. `"warning"`
   * is the compiler's word for this level — not "advisory".
   */
  severity: "error" | "warning";

  /**
   * JSON path to the offending value, in typia's `$input...` notation (e.g.
   * `$input.joints[3].flexion`). This is the anchor the `// ❌` comment attaches
   * to.
   */
  path: string;

  /**
   * Human / LLM readable statement of what was required, precise enough to act
   * on (e.g. `"leftLowerArm flexion must be within [0, 150]° (anatomical ROM),
   * but was 175"`).
   */
  expected: string;

  /**
   * The actual offending value, carried verbatim for the feedback comment.
   * `unknown` because a violation can occur at any field type — this is the one
   * deliberate `unknown` at the validation boundary.
   */
  value: unknown;

  /**
   * Signed magnitude by which the value missed the bound, in the channel's own
   * unit (degrees for ROM): how far _past_ the limit it sat (an elbow at 175°
   * against a 150° max → `25`). Present only for numeric overshoots; lets a
   * corrector judge severity (a 2° graze vs a 90° break) and the `// ❌` comment
   * quote the gap. Absent for non-numeric or non-magnitude violations.
   */
  overshoot?: number;
}
