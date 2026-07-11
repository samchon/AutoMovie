import { validateContinuity } from "@automovie/engine";
import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndState,
  IAutoMovieMountBinding,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation, hasWarning, warningCount } from "../internal/predicates";

const FORWARD: IAutoMovieVector3 = { x: 0, y: 0, z: 1 };

const actor = (props: {
  node: string;
  x?: number;
  facing?: IAutoMovieVector3;
  mount?: IAutoMovieMountBinding | null;
}): IAutoMovieBeatEndActorState => ({
  node: props.node,
  transform: {
    ...IDENTITY_TRANSFORM,
    translation: { x: props.x ?? 0, y: 0, z: 0 },
  },
  facing: props.facing ?? FORWARD,
  pose: null,
  motion: null,
  localTime: 0,
  gaitPhase: null,
  rootVelocity: null,
  footPlants: null,
  mount: props.mount ?? null,
});

const state = (
  actors: IAutoMovieBeatEndActorState[],
): IAutoMovieBeatEndState => ({ beat: "b", shot: "shot:b", actors });

const saddle: IAutoMovieMountBinding = { parent: "horse", bone: "spine" };

/**
 * The cut-boundary continuity linter (#1172): the incoming beat's opening state
 * against the previous beat's recorded end-state. Drift is advisory (a warning,
 * never a gate) — a cut may intend a jump — so a success carries warnings, and
 * only a nonsensical tolerance is an error.
 *
 * Scenarios:
 *
 * 1. A clean resume — same position, same facing, mount preserved — passes with no
 *    warnings (position/facing within tolerance and mount unchanged: every
 *    negative branch).
 * 2. Position drift past the tolerance warns at the translation path.
 * 3. Facing drift past the tolerance warns at the facing path.
 * 4. A dropped mount (rider unmounted), a changed parent, and a changed bone each
 *    warn at the mount path — the "props disappear" failure.
 * 5. An actor that ended the prior beat but is absent from the incoming opening
 *    warns rather than silently skipping.
 * 6. A generous position tolerance suppresses a large drift (provided tolerance
 *    honored, drift-within-bound branch).
 * 7. A negative position tolerance and an out-of-band facing tolerance are each
 *    range ERRORS (not warnings), and short-circuit before any comparison.
 */
export const test_validation_continuity = (): void => {
  // 1. clean resume with a preserved mount — no warnings.
  const clean = validateContinuity({
    previous: state([actor({ node: "rider", x: 2, mount: saddle })]),
    opening: state([actor({ node: "rider", x: 2, mount: saddle })]),
  });
  TestValidator.equals("clean resume passes", clean, { success: true });

  // 2. position drift.
  const drift = validateContinuity({
    previous: state([actor({ node: "hero", x: 0 })]),
    opening: state([actor({ node: "hero", x: 1 })]),
  });
  TestValidator.predicate(
    "position drift warns",
    hasWarning(
      drift,
      "physics",
      "$input.opening.actors[node=hero].transform.translation",
    ),
  );

  // 3. facing drift (90 degrees off forward).
  const spun = validateContinuity({
    previous: state([actor({ node: "hero", facing: FORWARD })]),
    opening: state([actor({ node: "hero", facing: { x: 1, y: 0, z: 0 } })]),
  });
  TestValidator.predicate(
    "facing drift warns",
    hasWarning(spun, "physics", "$input.opening.actors[node=hero].facing"),
  );

  // 4. mount discontinuity — dropped, changed parent, changed bone.
  const dropped = validateContinuity({
    previous: state([actor({ node: "rider", mount: saddle })]),
    opening: state([actor({ node: "rider", mount: null })]),
  });
  const reparent = validateContinuity({
    previous: state([actor({ node: "rider", mount: saddle })]),
    opening: state([
      actor({ node: "rider", mount: { parent: "cart", bone: "spine" } }),
    ]),
  });
  const rebone = validateContinuity({
    previous: state([actor({ node: "rider", mount: saddle })]),
    opening: state([
      actor({ node: "rider", mount: { parent: "horse", bone: "hips" } }),
    ]),
  });
  TestValidator.predicate(
    "dropped mount warns",
    hasWarning(dropped, "physics", "$input.opening.actors[node=rider].mount"),
  );
  TestValidator.predicate(
    "reparented mount warns",
    hasWarning(reparent, "physics", "$input.opening.actors[node=rider].mount"),
  );
  TestValidator.predicate(
    "rebound mount warns",
    hasWarning(rebone, "physics", "$input.opening.actors[node=rider].mount"),
  );

  // 5. actor missing from the incoming opening.
  const missing = validateContinuity({
    previous: state([actor({ node: "hero" })]),
    opening: state([actor({ node: "extra" })]),
  });
  TestValidator.predicate(
    "absent actor warns",
    hasWarning(missing, "physics", "$input.opening.actors"),
  );

  // 6. a generous tolerance suppresses a large drift — no warning.
  const tolerant = validateContinuity({
    previous: state([actor({ node: "hero", x: 0 })]),
    opening: state([actor({ node: "hero", x: 3 })]),
    positionTolerance: 5,
  });
  TestValidator.equals("tolerance suppresses drift", warningCount(tolerant), 0);

  // 7. nonsensical tolerances are range errors that short-circuit.
  const badPos = validateContinuity({
    previous: state([actor({ node: "hero", x: 0 })]),
    opening: state([actor({ node: "hero", x: 9 })]),
    positionTolerance: -1,
  });
  TestValidator.predicate(
    "negative position tolerance is a range error",
    hasViolation(badPos, "range", "$input.positionTolerance"),
  );
  const badFacing = validateContinuity({
    previous: state([actor({ node: "hero" })]),
    opening: state([actor({ node: "hero" })]),
    facingToleranceDeg: 400,
  });
  TestValidator.predicate(
    "out-of-band facing tolerance is a range error",
    hasViolation(badFacing, "range", "$input.facingToleranceDeg"),
  );
};
