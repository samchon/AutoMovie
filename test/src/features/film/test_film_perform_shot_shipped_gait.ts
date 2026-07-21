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
 * A retargeted quadruped's shape: a gait whose content reaches the ARM chains,
 * which is the case #1349 was filed for and must keep refusing.
 */
const ARMED_GAIT: IAutoMovieGait = {
  ...HUMANOID_GAITS.walk,
  limbs: [
    ...HUMANOID_GAITS.walk.limbs,
    { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 18 },
  ],
};

/**
 * The plainest film performs: one actor, one shipped gait, no `region` (#1359).
 *
 * Every perform-side fixture in this suite builds its own leg-only gait, so the
 * shipped `HUMANOID_GAITS` never met the region mask in a test even though they
 * are what a host actually drops into an actor context. They used to
 * counter-swing the arms, which `locomote`'s `lowerBody` default does not
 * carry, and since #1349 masked content is a violation, so the engine's own
 * shipped gait was refused by the engine's own default region: a lone actor
 * walking was impossible, the repository's film page threw on load, and the
 * capture pipeline stopped with it.
 *
 * The resolution changed the CONTENT, not the gate: the table now authors only
 * what the verb's default region carries. That is why this scenario asserts a
 * clean perform rather than a softened one, and why scenario 4 exists — the
 * mask still refuses content it cannot carry, exactly as #1349 wrote it.
 *
 * It runs the real synthesizer rather than a stub, so the gait content under
 * test is the shipped content.
 *
 * Scenarios:
 *
 * 1. A `region`-less `locomote` on the shipped `walk` performs with NO violations:
 *    the engine's default content and its default region agree.
 * 2. The compiled clip carries the gait's LEG rows, so the walk that performed is
 *    a real walk and not an empty success.
 * 3. Every shipped gait behaves the same way: `walk`, `run`, `sprint`, `sneak` and
 *    `march` all perform under the default region.
 * 4. The gate is untouched (#1349): the same action, with a gait that reaches the
 *    arm chains the way a retargeted quadruped's front legs do, is still
 *    REFUSED at `$input.draft[0].region`, naming the bone. The engine stopped
 *    authoring content its own default cannot carry; it did not stop reporting
 *    an author's.
 * 5. Widening still works and is still unnecessary: the shipped walk on `fullBody`
 *    performs too, and the armed gait performs there as well, which is the
 *    remedy the refusal in 4 names.
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

  // 1. the plain walk performs, with nothing to report
  const plain = perform([walk(), frame], HUMANOID_GAITS.walk);
  TestValidator.equals(
    "a shipped walk with no region performs",
    plain.success,
    true,
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

  // 3. every shipped gait, under the default region
  TestValidator.equals(
    "every shipped gait performs",
    (["walk", "run", "sprint", "sneak", "march"] as const).filter(
      (name) => perform([walk(), frame], HUMANOID_GAITS[name]).success !== true,
    ),
    [],
  );

  // 4. NEGATIVE TWIN: the mask still refuses content the region cannot carry
  const armed = perform([walk(), frame], ARMED_GAIT);
  TestValidator.predicate(
    "a gait reaching the arm chains is still refused, by the bone it named",
    armed.success === false &&
      armed.violations.some(
        (v) =>
          v.path === "$input.draft[0].region" &&
          v.expected.includes("leftUpperArm") &&
          v.expected.includes("lowerBody"),
      ),
  );

  // 5. widening is still the remedy that refusal names
  TestValidator.equals(
    "the shipped walk on fullBody performs too",
    perform([walk("fullBody"), frame], HUMANOID_GAITS.walk).success,
    true,
  );
  const widenedArmed = perform([walk("fullBody"), frame], ARMED_GAIT);
  TestValidator.predicate(
    "and the armed gait performs there, keeping the arm row",
    widenedArmed.success === true &&
      widenedArmed.motions
        .knightA!.keyframes.flatMap((k) => k.pose.joints.map((j) => j.bone))
        .includes("leftUpperArm"),
  );
};
