import {
  HUMANOID_GAITS,
  makeActorSynthesizer,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieCameraAction,
  IAutoMovieGait,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";

const frame: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
};

const walk = (
  region?: IAutoMovieActionCall["region"],
): IAutoMovieActionCall => ({
  verb: "locomote",
  actor: "knightA",
  start: 0,
  duration: 1,
  gait: "walk",
  to: { kind: "point", point: { x: 0, y: 0, z: 0.25 } },
  ...(region === undefined ? {} : { region }),
});

/** The bones a gait spec drives, as its limb rows name them. */
const gaitBones = (gait: IAutoMovieGait): string[] =>
  gait.limbs.map((limb) => limb.bone);

/**
 * The plainest film performs: one actor, one shipped gait, no `region` (#1359).
 *
 * Every perform-side fixture in this suite builds its own leg-only gait, so the
 * shipped `HUMANOID_GAITS` never met the region mask in a test even though they
 * are what an agent actually passes. They counter-swing the arms, which
 * `locomote`'s `lowerBody` default does not carry, and while masked content
 * FAILED the shot that made a lone actor walking impossible: the repository's
 * own film page threw on load and the whole capture pipeline stopped with it.
 *
 * The mask still reports what it drops; it reports it as advice on the success
 * arm. This scenario is the end-to-end witness that was missing, and it runs
 * the real synthesizer rather than a stub so the gait content is the shipped
 * content.
 *
 * Scenarios:
 *
 * 1. A `region`-less `locomote` on the shipped `walk` performs, and the warning it
 *    carries names the arm rows that gait authors.
 * 2. The compiled clip carries the gait's LEG rows, so the walk that performed is
 *    a real walk and not an empty success.
 * 3. Every shipped gait behaves the same way: `walk`, `run`, `sprint`, `sneak`,
 *    and `march` all perform, since all of them swing the arms.
 * 4. Negative twin: the same action on `fullBody` performs with no warning, and
 *    its clip then carries the arm rows too.
 */
export const test_film_perform_shot_shipped_gait = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");
  const skeleton = createSkeleton();
  const perform = (draft: IAutoMovieActionCall[], gait: IAutoMovieGait) =>
    performShot({
      script: makeScriptWrite(),
      staged,
      performance: makePerformanceWrite({
        draft,
        revise: { review: "unchanged.", final: null },
      }),
      synthesize: makeActorSynthesizer(
        new Map([
          [
            "knightA",
            {
              skeleton: skeleton.id,
              gaits: [gait],
              position: { x: 0, y: 0, z: 0 },
              speed: 1.2,
              facingDeg: 0,
              eyeHeight: 1.7,
              restPose: { skeleton: skeleton.id, root: null, joints: [] },
              rig: skeleton,
            },
          ],
        ]),
        new Map(
          staged.scene.nodes.map((node) => [
            node.id,
            node.transform.translation,
          ]),
        ),
      ),
      // No rig on the gate: this scenario is about the region mask meeting the
      // shipped content, not about ROM, which has its own scenarios.
      skeleton: () => null,
    });

  // 1. the plain walk performs, and says what it dropped
  const plain = perform([walk(), frame], HUMANOID_GAITS.walk);
  TestValidator.equals(
    "a shipped walk with no region performs",
    plain.success,
    true,
  );
  TestValidator.predicate(
    "its warning names the arm rows the shipped gait authors",
    plain.success === true &&
      (plain.warnings ?? []).some(
        (v) =>
          v.severity === "warning" &&
          v.path === "$input.draft[0].region" &&
          v.expected.includes("leftUpperArm") &&
          v.expected.includes("rightUpperArm"),
      ),
  );

  // 2. the walk that performed is a real walk: the legs are in the clip
  const legs = gaitBones(HUMANOID_GAITS.walk).filter(
    (bone) => bone.endsWith("UpperLeg") || bone.endsWith("LowerLeg"),
  );
  const compiled = new Set(
    plain.success === true
      ? plain.motions.knightA!.keyframes.flatMap((k) =>
          k.pose.joints.map((j) => j.bone as string),
        )
      : [],
  );
  TestValidator.predicate(
    "the compiled clip carries the gait's leg rows",
    legs.length > 0 && legs.every((bone) => compiled.has(bone)),
  );

  // 3. every shipped gait, since every one of them swings the arms
  TestValidator.equals(
    "every shipped gait performs",
    (["walk", "run", "sprint", "sneak", "march"] as const).filter(
      (name) => perform([walk(), frame], HUMANOID_GAITS[name]).success !== true,
    ),
    [],
  );

  // 4. NEGATIVE TWIN: widened region, no warning, arms kept
  const widened = perform([walk("fullBody"), frame], HUMANOID_GAITS.walk);
  TestValidator.equals(
    "the same walk on fullBody performs",
    widened.success,
    true,
  );
  TestValidator.equals(
    "and carries no warning at all",
    widened.success === true ? (widened.warnings ?? []).length : -1,
    0,
  );
  TestValidator.predicate(
    "its clip keeps the arm rows the narrow region dropped",
    widened.success === true &&
      widened.motions
        .knightA!.keyframes.flatMap((k) => k.pose.joints.map((j) => j.bone))
        .includes("leftUpperArm"),
  );
};
