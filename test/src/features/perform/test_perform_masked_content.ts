import {
  IAutoMovieActionSynthesizer,
  compilePerformance,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieExpression,
  IAutoMovieMotion,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";

const HAPPY: IAutoMovieExpression = {
  preset: "happy",
  intensity: 0.5,
  blendshapes: null,
};

const ROOT: IAutoMovieTransform = {
  translation: { x: 1, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/** A two-keyframe clip whose keyframes may name DIFFERENT bone sets. */
const clip = (
  first: AutoMovieHumanoidBone[],
  second: AutoMovieHumanoidBone[],
  extra: { root?: boolean; expression?: boolean } = {},
): IAutoMovieMotion =>
  makeMotion(
    [first, second].map((bones, index) =>
      keyframe(
        index,
        makePose(
          bones.map((bone) => joint(bone, { flexion: 10 })),
          extra.root === true ? ROOT : null,
        ),
        "linear",
        extra.expression === true ? HAPPY : null,
      ),
    ),
    1,
  );

const locomote = (actor: string | string[]): IAutoMovieActionCall => ({
  verb: "locomote",
  actor,
  start: 0,
  duration: 1,
  region: "lowerBody",
  gait: "walk",
  to: { kind: "point", point: { x: 0, y: 0, z: 1 } },
});

const wave = (actor: string): IAutoMovieActionCall => ({
  verb: "gesture",
  kind: "wave",
  actor,
  start: 0,
  duration: 1,
});

const emote = (actor: string): IAutoMovieActionCall => ({
  verb: "emote",
  preset: "happy",
  intensity: 0.5,
  actor,
  start: 0,
  duration: 1,
});

/**
 * `compilePerformance` states the content its region masks discarded (#1349).
 * The mask itself is unchanged and still deliberate: what changed is that the
 * producer no longer stays silent about it, so the caller owning the success
 * envelope can refuse instead of returning a clip that is missing half of what
 * the author wrote. This pins the report's shape, ordering, and emptiness; the
 * shot-level refusal it feeds is pinned by
 * `test_film_perform_shot_masked_channels`.
 *
 * Scenarios:
 *
 * 1. Negative twin: a clip entirely inside its own region produces an EMPTY
 *    `masked` list, and the performance is unchanged.
 * 2. Bones are deduplicated across keyframes and reported in code-unit order, with
 *    the action index, the actor, and the region that masked them; the root and
 *    expression flags stay false when neither was authored.
 * 3. The root channel: layering a `gesture` (upperBody) beside a `locomote`
 *    (lowerBody) strips the gesture's root, which is reported, while the
 *    locomotion region keeps its own root and reports nothing.
 * 4. The expression channel is the mirror: a `face` clip keeps its expression and
 *    loses every bone, while a non-face clip loses the expression.
 * 5. Ordering is by action index, then by actor id, so a unison action masked for
 *    two actors reports both in a stable order.
 */
export const test_perform_masked_content = (): void => {
  // 1. nothing outside the region: an empty report
  const legOnly: IAutoMovieActionSynthesizer = () =>
    clip(["leftUpperLeg"], ["leftUpperLeg"]);
  const clean = compilePerformance([locomote("hero")], legOnly);
  TestValidator.equals("an in-region clip masks nothing", clean.masked, []);
  TestValidator.equals(
    "the in-region clip keeps its bone",
    clean.performances.hero!.keyframes[1]!.pose.joints.map((j) => j.bone),
    ["leftUpperLeg"],
  );

  // 2. dedupe across keyframes, code-unit order, flags off
  const armLeak: IAutoMovieActionSynthesizer = () =>
    clip(
      ["rightHand", "leftUpperArm", "leftUpperLeg"],
      ["leftUpperArm", "leftHand"],
    );
  const leaked = compilePerformance([locomote("hero")], armLeak);
  TestValidator.equals(
    "the masked record names the action, actor, region and bones",
    leaked.masked,
    [
      {
        action: 0,
        actor: "hero",
        region: "lowerBody",
        bones: ["leftHand", "leftUpperArm", "rightHand"],
        root: false,
        expression: false,
      },
    ],
  );

  // 3. the root channel, which only layering strips
  const rooted: IAutoMovieActionSynthesizer = (action) =>
    action.verb === "locomote"
      ? clip(["leftUpperLeg"], ["leftUpperLeg"], { root: true })
      : clip(["leftUpperArm"], ["leftUpperArm"], { root: true });
  const layered = compilePerformance([locomote("hero"), wave("hero")], rooted);
  TestValidator.equals(
    "only the non-locomotion region's root is reported",
    layered.masked,
    [
      {
        action: 1,
        actor: "hero",
        region: "upperBody",
        bones: [],
        root: true,
        expression: false,
      },
    ],
  );

  // 4. the expression channel: face keeps it and loses every bone
  const faced: IAutoMovieActionSynthesizer = () =>
    clip(["leftUpperArm"], ["leftUpperArm"], { expression: true });
  const face = compilePerformance([emote("hero")], faced);
  TestValidator.equals(
    "a face clip loses its bones and keeps its expression",
    face.masked,
    [
      {
        action: 0,
        actor: "hero",
        region: "face",
        bones: ["leftUpperArm"],
        root: false,
        expression: false,
      },
    ],
  );
  TestValidator.equals(
    "the face region's expression survives the mask",
    face.performances.hero!.keyframes[1]!.expression?.preset ?? null,
    "happy",
  );
  const nonFace = compilePerformance([wave("hero")], faced);
  TestValidator.equals(
    "a non-face clip loses the expression instead",
    nonFace.masked,
    [
      {
        action: 0,
        actor: "hero",
        region: "upperBody",
        bones: [],
        root: false,
        expression: true,
      },
    ],
  );

  // 5. ordering: action index first, then actor id
  const ordered = compilePerformance(
    [wave("zeta"), locomote(["beta", "alpha"])],
    armLeak,
  );
  TestValidator.equals(
    "masked records sort by action index, then actor",
    ordered.masked.map((m) => `${m.action}:${m.actor}`),
    ["0:zeta", "1:alpha", "1:beta"],
  );
};
