import {
  IAutoMovieActionSynthesizer,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieCameraAction,
  IAutoMovieExpression,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { hasViolation, violationCount } from "../internal/predicates";

/** The hind legs of a retargeted quadruped: the humanoid `lowerBody` chain. */
const HIND: AutoMovieHumanoidBone[] = [
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
];

/** The front legs of a retargeted quadruped: the humanoid arm chains. */
const FORE: AutoMovieHumanoidBone[] = [
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
];

/** The fore-leg bones as the violation must name them: code-unit sorted. */
const FORE_SORTED =
  "leftHand, leftLowerArm, leftUpperArm, rightHand, rightLowerArm, rightUpperArm";

const HAPPY: IAutoMovieExpression = {
  preset: "happy",
  intensity: 0.5,
  blendshapes: null,
};

const rootAt = (x: number): IAutoMovieTransform => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** A two-keyframe clip over `bones`, optionally carrying a root / expression. */
const clip = (props: {
  bones: AutoMovieHumanoidBone[];
  root?: boolean;
  expression?: boolean;
}): IAutoMovieMotion => {
  const pose = (flexion: number): IAutoMoviePose =>
    makePose(
      props.bones.map((bone) => joint(bone, { flexion })),
      props.root === true ? rootAt(flexion / 20) : null,
    );
  const expression = props.expression === true ? HAPPY : null;
  return makeMotion(
    [
      keyframe(0, pose(0), "linear", expression),
      keyframe(1, pose(20), "linear", expression),
    ],
    1,
  );
};

const gait = (
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

const frame: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
};

const bonesOf = (motion: IAutoMovieMotion): Set<AutoMovieHumanoidBone> =>
  new Set(motion.keyframes.flatMap((k) => k.pose.joints.map((j) => j.bone)));

/**
 * `perform` must never drop authored content in silence (#1349). The
 * body-region mask is deliberate (disjoint regions are what let a walk and a
 * wave layer), but it used to discard whatever fell outside the action's region
 * and still return `success: true` with zero violations: a benchmark run
 * shipped a walking quadruped whose two front legs never moved, because a
 * retargeted quadruped's fore legs ride the humanoid ARM chains and `locomote`
 * defaults to `lowerBody`. The compiler holds both facts at the moment it drops
 * one, so it now states what it masked and the shot gate refuses, pointing at
 * the `region` field the author owns rather than at the compiled clip they
 * would have to diff.
 *
 * Scenarios:
 *
 * 1. Positive. A twelve-bone quadruped gait under a `region`-less `locomote`
 *    fails, with a `type` violation on `$input.draft[0].region` naming every
 *    one of the six masked fore-leg bones in code-unit order.
 * 2. Negative twin. The same gait with `region: "fullBody"` succeeds with zero
 *    violations, and the compiled clip carries all twelve bones.
 * 3. Boundary, the region's own bones. A gait confined to `hips` plus the hind
 *    chain (all inside `lowerBody`, `hips` being the member a leg chain sits
 *    next to) succeeds and reports nothing.
 * 4. The other two masked channels. A `head` action layered beside a `lowerBody`
 *    one loses its root, and any non-`face` clip loses its expression; both are
 *    named in one violation, while a clip losing only its expression names just
 *    that.
 * 5. One record per (action, actor): a unison action masked for two actors reports
 *    each separately, ordered by action index then actor id.
 */
export const test_film_perform_shot_masked_channels = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");
  const perform = (
    draft: IAutoMovieActionCall[],
    synthesize: IAutoMovieActionSynthesizer,
  ) =>
    performShot({
      script: makeScriptWrite(),
      staged,
      performance: makePerformanceWrite({
        draft,
        revise: { review: "unchanged.", final: null },
      }),
      synthesize,
      // No rig: this scenario is about the region mask, not about ROM, so the
      // motion gate stays out of the picture on both sides of the twin.
      skeleton: () => null,
    });

  // 1. positive: the S-07 shape, region omitted
  const quadruped = clip({ bones: [...HIND, ...FORE] });
  const dropped = perform([gait(), frame], () => quadruped);
  TestValidator.equals(
    "a gait reaching outside its region fails the shot",
    dropped.success,
    false,
  );
  TestValidator.predicate(
    "the drop is reported on the action's own region field",
    hasViolation(dropped, "type", "$input.draft[0].region"),
  );
  TestValidator.predicate(
    "the violation names every masked bone in code-unit order",
    dropped.success === false &&
      dropped.violations.some(
        (v) =>
          v.path === "$input.draft[0].region" &&
          v.expected.includes(FORE_SORTED) &&
          v.expected.includes('"lowerBody"') &&
          v.value === "lowerBody",
      ),
  );

  // 2. negative twin: the same gait, region widened to one that owns the bones
  const widened = perform([gait("fullBody"), frame], () => quadruped);
  TestValidator.equals(
    "the same gait on fullBody performs",
    widened.success,
    true,
  );
  TestValidator.equals(
    "the widened shot reports nothing",
    violationCount(widened),
    0,
  );
  TestValidator.equals(
    "all twelve authored bones survive to the compiled clip",
    widened.success === true ? bonesOf(widened.motions.knightA!).size : -1,
    12,
  );

  // 3. boundary: hips is the lowerBody member a leg gait sits next to
  const clean = perform([gait(), frame], () =>
    clip({ bones: ["hips", ...HIND] }),
  );
  TestValidator.equals(
    "a gait entirely inside its region performs",
    clean.success,
    true,
  );
  TestValidator.equals(
    "an in-region gait reports nothing",
    violationCount(clean),
    0,
  );

  // 4. the root and expression channels, and an expression-only drop
  const rootAndFace = perform(
    [
      gait(),
      {
        verb: "lookAt",
        actor: "knightA",
        start: 0,
        duration: 1,
        to: { kind: "node", node: "knightB" },
      },
      frame,
    ],
    (action) =>
      action.verb === "locomote"
        ? clip({ bones: ["hips"], expression: true })
        : clip({ bones: ["head"], root: true, expression: true }),
  );
  TestValidator.predicate(
    "a layered non-locomotion region reports its dropped root and expression",
    rootAndFace.success === false &&
      rootAndFace.violations.some(
        (v) =>
          v.path === "$input.draft[1].region" &&
          v.expected.includes("a root displacement and an expression") &&
          v.value === "head",
      ),
  );
  TestValidator.predicate(
    "a clip losing only its expression names only that",
    rootAndFace.success === false &&
      rootAndFace.violations.some(
        (v) =>
          v.path === "$input.draft[0].region" &&
          v.expected.includes("authors an expression") &&
          !v.expected.includes("root displacement") &&
          !v.expected.includes("the bones"),
      ),
  );

  // 5. one record per (action, actor), ordered by action index then actor
  const unison = perform(
    [
      {
        verb: "locomote",
        actor: ["knightB", "knightA"],
        start: 0,
        duration: 1,
        gait: "walk",
        to: { kind: "point", point: { x: 0, y: 0, z: 0.25 } },
      },
      frame,
    ],
    () => quadruped,
  );
  TestValidator.equals(
    "a unison action reports each masked actor, ordered by actor id",
    unison.success === false
      ? unison.violations.map((v) => v.expected.split("'s clip")[0]!)
      : [],
    ["knightA", "knightB"],
  );
};
