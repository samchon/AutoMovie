import { MoticaViolationKind } from "./MoticaViolationKind";

/**
 * One deterministic constraint violation — the unit of feedback the harness
 * turns into a `// ❌` correction comment.
 *
 * This is motica's domain-level analogue of typia's `IValidation.IError`,
 * enriched with a {@link MoticaViolationKind} (so failures route to the right
 * tier/corrector) and a human-and-LLM-readable `expected` string. The engine
 * emits these from its ROM / physics / temporal verifiers; `@motica/agent`
 * lowers them onto the offending JSON path so the model sees exactly what was
 * wrong on its own output and fixes only that field. This object _is_ how
 * "physically impossible poses are rejected" becomes an actionable signal
 * rather than a silent failure.
 *
 * @author Samchon
 */
export interface IMoticaConstraintViolation {
  /** Which tier/category failed — routes the correction. */
  kind: MoticaViolationKind;

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
}
