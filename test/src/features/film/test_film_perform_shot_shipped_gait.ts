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

/** A custom gait that genuinely authors legs only. */
const LEG_ONLY_GAIT: IAutoMovieGait = {
  ...HUMANOID_GAITS.walk,
  limbs: HUMANOID_GAITS.walk.limbs.filter(
    (limb) => !limb.bone.endsWith("UpperArm"),
  ),
};

/**
 * The plainest film performs: one actor, one shipped gait, no `region` (#1359).
 *
 * `locomote` carries the shipped counter-swing through its `fullBody` default.
 * Overlap safety follows the synthesized root/bones/expression rather than the
 * broad region label, so this gait layers with a head-only look but not an arm
 * gesture.
 *
 * It runs the real synthesizer rather than a stub, so the gait content under
 * test is the shipped content.
 *
 * Scenarios:
 *
 * 1. A region-less shipped walk performs with no violations.
 * 2. The compiled clip carries every leg and arm gait row.
 * 3. Every shipped gait behaves the same way: `walk`, `run`, `sprint`, `sneak` and
 *    `march` all perform under the default region.
 * 4. Locomote + lookAt layers, while locomote + wave is refused on the shared
 *    upper arm.
 * 5. A custom legs-only gait layers with the same wave.
 * 6. An explicit `lowerBody` override still reports the arm rows it would mask.
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

  // 2. the walk carries every authored gait row, including both arms.
  const gaitRows = gaitBones(HUMANOID_GAITS.walk);
  const compiled = new Set(
    plain.success === true
      ? plain.motions.knightA!.keyframes.flatMap((k) =>
          k.pose.joints.map((j) => j.bone as string),
        )
      : [],
  );
  TestValidator.predicate(
    "the compiled clip carries every gait row",
    gaitRows.length > 0 && gaitRows.every((bone) => compiled.has(bone)),
  );

  // 3. every shipped gait, under the default region
  TestValidator.equals(
    "every shipped gait performs",
    (["walk", "run", "sprint", "sneak", "march"] as const).filter(
      (name) => perform([walk(), frame], HUMANOID_GAITS[name]).success !== true,
    ),
    [],
  );

  // 4. Head-only content layers, arm content collides on the actual bone.
  const lookAt: IAutoMovieActionCall = {
    verb: "lookAt",
    actor: "knightA",
    start: 0,
    duration: 1,
    to: { kind: "node", node: "knightB" },
  };
  TestValidator.equals(
    "a shipped walk layers with a head-only lookAt",
    perform([walk(), lookAt, frame], HUMANOID_GAITS.walk).success,
    true,
  );
  const wave: IAutoMovieActionCall = {
    verb: "gesture",
    actor: "knightA",
    start: 0,
    duration: 1,
    kind: "wave",
  };
  const walkAndWave = perform([walk(), wave, frame], HUMANOID_GAITS.walk);
  TestValidator.predicate(
    "a shipped walk conflicts with a wave on their shared arm",
    walkAndWave.success === false &&
      walkAndWave.violations.some(
        (v) =>
          v.path === "$input.draft[1].start" &&
          v.expected.includes("rightUpperArm"),
      ),
  );

  // 5. Content, not the fullBody label, decides the overlap.
  TestValidator.equals(
    "a custom legs-only gait layers with the same wave",
    perform([walk(), wave, frame], LEG_ONLY_GAIT).success,
    true,
  );

  // 6. An authored narrow override still cannot silently discard the arms.
  const narrowed = perform([walk("lowerBody"), frame], HUMANOID_GAITS.walk);
  TestValidator.predicate(
    "an explicit lowerBody override reports the masked arm rows",
    narrowed.success === false &&
      narrowed.violations.some(
        (violation) =>
          violation.path === "$input.draft[0].region" &&
          violation.expected.includes("leftUpperArm") &&
          violation.expected.includes("rightUpperArm"),
      ),
  );
};
