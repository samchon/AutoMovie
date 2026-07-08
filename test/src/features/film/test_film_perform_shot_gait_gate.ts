import { performShot, stageScene } from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieCameraAction,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const locomote = (gait: string): IAutoMovieActionCall => ({
  verb: "locomote",
  actor: "knightA",
  start: 0,
  duration: 1,
  gait,
  to: { kind: "point", point: { x: 0, y: 0, z: 0.25 } },
});

const frame: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
};

const run = (
  gait: string,
  gaits: ((node: string) => readonly string[] | undefined) | undefined,
) =>
  performShot({
    script: makeScriptWrite(),
    staged: (() => {
      const s = stageScene(makeScriptWrite(), makeStagingWrite());
      if (s.success !== true) throw new Error("staging must succeed");
      return s;
    })(),
    performance: makePerformanceWrite({
      draft: [locomote(gait), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
    ...(gaits === undefined ? {} : { gaits }),
  });

/**
 * The `locomote` gait gate. `gait` is a free string resolved by name against
 * the gaits the actor's context supplies; the reference synthesiser would
 * otherwise return no motion for an unknown one, silently freezing the actor.
 * With the `gaits` lookup wired, an unresolved gait is a `type` violation on
 * `$input.draft[i].gait`; without it the check is skipped (byte-identical to
 * before the gate existed).
 *
 * Cases: (a) a supplied gait passes; (b) an unsupplied gait is reported with
 * the actor's available names; (c) an actor with no gaits reads "none
 * supplied"; (d) omitting the lookup skips the gate entirely even for an
 * unknown gait.
 */
export const test_film_perform_shot_gait_gate = (): void => {
  // (a) gait present in the supplied set → no gait violation
  const present = run("walk", () => ["walk", "run"]);
  TestValidator.equals("supplied gait passes the gate", present.success, true);

  // (b) gait absent, actor supplies some gaits → violation names them
  const absent = run("march", () => ["walk", "run"]);
  TestValidator.equals("unsupplied gait fails the gate", absent.success, false);
  TestValidator.predicate(
    "unsupplied gait is reported on $input.draft[0].gait",
    hasViolation(absent, "type", "$input.draft[0].gait"),
  );
  TestValidator.predicate(
    "the violation lists the actor's available gaits",
    absent.success === false &&
      absent.violations.some(
        (v) =>
          v.path.includes("[0].gait") &&
          v.expected.includes("walk, run") &&
          v.expected.includes('"march"'),
      ),
  );

  // (c) actor supplies no gaits → "none supplied"
  const none = run("march", () => []);
  TestValidator.predicate(
    "an actor with no gaits reads 'none supplied'",
    none.success === false &&
      none.violations.some(
        (v) =>
          v.path.includes("[0].gait") && v.expected.includes("none supplied"),
      ),
  );

  // (d) lookup omitted → gate skipped even for an unknown gait (byte-identical)
  const skipped = run("march", undefined);
  TestValidator.equals(
    "omitting the gaits lookup skips the gate",
    skipped.success,
    true,
  );

  // (d') lookup present but returns undefined for the actor → also skipped
  const unknownActor = run("march", () => undefined);
  TestValidator.equals(
    "an undefined gait set for the actor skips the gate",
    unknownActor.success,
    true,
  );
};
