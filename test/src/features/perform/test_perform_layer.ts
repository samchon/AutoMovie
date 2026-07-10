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
import { nclose } from "../internal/predicates";

const HAPPY: IAutoMovieExpression = {
  preset: "happy",
  intensity: 0.8,
  blendshapes: null,
};

const rootAt = (x: number): IAutoMovieTransform => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const jointClip = (
  bone: AutoMovieHumanoidBone,
  end: number,
  leak: { bone: AutoMovieHumanoidBone; end: number } | null = null,
  rootX: number | null = null,
): IAutoMovieMotion =>
  makeMotion(
    [
      keyframe(
        0,
        makePose(
          [
            joint(bone, { flexion: 0 }),
            ...(leak === null ? [] : [joint(leak.bone, { flexion: 0 })]),
          ],
          rootX === null ? null : rootAt(0),
        ),
      ),
      keyframe(
        1,
        makePose(
          [
            joint(bone, { flexion: end }),
            ...(leak === null ? [] : [joint(leak.bone, { flexion: leak.end })]),
          ],
          rootX === null ? null : rootAt(rootX),
        ),
      ),
    ],
    1,
  );

const emoteClip = (): IAutoMovieMotion =>
  makeMotion(
    [
      keyframe(0, makePose([]), "linear", HAPPY),
      keyframe(1, makePose([]), "linear", HAPPY),
    ],
    1,
  );

/** A region-appropriate clip per verb; null for anything else. */
const synth: IAutoMovieActionSynthesizer = (
  action: IAutoMovieActionCall,
): IAutoMovieMotion | null => {
  if (action.verb === "locomote")
    return jointClip("leftUpperLeg", 30, { bone: "leftUpperArm", end: 99 }, 1);
  if (action.verb === "gesture")
    return jointClip("leftUpperArm", 20, { bone: "leftUpperLeg", end: -99 }, 5);
  if (action.verb === "emote") return emoteClip();
  if (action.verb === "lookAt") return jointClip("head", 60);
  if (action.verb === "react")
    return makeMotion(
      [
        keyframe(0, makePose([joint("spine", { flexion: 0 })])),
        keyframe(0.5, makePose([joint("spine", { flexion: -20 })])),
        keyframe(1, makePose([joint("spine", { flexion: 0 })])),
      ],
      1,
    );
  return null;
};

const frameAt = (motion: IAutoMovieMotion, time: number) =>
  motion.keyframes.find((k) => nclose(k.time, time))!;

/**
 * `compilePerformance` layering — actions on disjoint body regions play
 * concurrently rather than taking turns.
 *
 * Scenarios:
 *
 * 1. A `locomote` (lowerBody), a `gesture` (upperBody, region set explicitly), and
 *    an `emote` (face) all start at 0. They occupy three disjoint regions, so
 *    the actor's performance layers them: at t=1 the merged pose drives both
 *    the leg and the arm, and the face's expression rides along. The fake
 *    synthesizer deliberately leaks cross-region joints and a gesture root; the
 *    compiler strips those before layering.
 * 2. The layering envelope (#1003): a lookAt starting at 3s claims no head bone
 *    before it starts, and past the locomotion's last keyframe only its ROOT
 *    persists (the walk's destination) while its joints release.
 * 3. A finished react's explicit-zero rest keyframes release their claims: a bow
 *    after the flinch window plays at full authored strength instead of being
 *    averaged toward zero.
 * 4. A late-starting composite pads a `step` rest keyframe at t=0, so shot
 *    sampling holds rest until the authored start instead of clamping the first
 *    pose backward.
 */
export const test_perform_layer = (): void => {
  const locomote: IAutoMovieActionCall = {
    verb: "locomote",
    gait: "walk",
    to: { kind: "node", node: "x" },
    actor: "hero",
    start: 0,
    duration: "auto",
  };
  const gesture: IAutoMovieActionCall = {
    verb: "gesture",
    kind: "wave",
    region: "upperBody",
    actor: "hero",
    start: 0,
    duration: "auto",
  };
  const emote: IAutoMovieActionCall = {
    verb: "emote",
    preset: "happy",
    intensity: 0.8,
    actor: "hero",
    start: 0,
    duration: "auto",
  };

  const perf = compilePerformance([locomote, gesture, emote], synth).hero!;

  TestValidator.predicate(
    "the layered clip spans one second",
    nclose(perf.duration, 1),
  );

  const end = frameAt(perf, 1);
  const joints = new Map(end.pose.joints.map((j) => [j.bone, j]));
  TestValidator.predicate(
    "the leg and the arm are driven at the same instant",
    joints.has("leftUpperLeg") && joints.has("leftUpperArm"),
  );
  TestValidator.predicate(
    "out-of-region joints are stripped before layering",
    nclose(joints.get("leftUpperLeg")!.flexion!, 30) &&
      nclose(joints.get("leftUpperArm")!.flexion!, 20),
  );
  TestValidator.predicate(
    "upper-body root leakage cannot override locomotion root",
    end.pose.root !== null && nclose(end.pose.root.translation.x, 1),
  );
  TestValidator.predicate(
    "the face's expression rides along",
    end.expression !== null && end.expression.preset === "happy",
  );

  // 2. the layering envelope (#1003): a region claims its bones only from its
  //    first keyframe onward; past its last, only the root persists
  const lateLook: IAutoMovieActionCall = {
    verb: "lookAt",
    to: { kind: "node", node: "x" },
    actor: "hero",
    start: 3,
    duration: 1,
  };
  const late = compilePerformance([locomote, lateLook], synth).hero!;
  const boneAt = (time: number, bone: AutoMovieHumanoidBone) =>
    frameAt(late, time).pose.joints.find((j) => j.bone === bone);
  TestValidator.predicate(
    "a late lookAt claims nothing before it starts (causality)",
    boneAt(0, "head") === undefined && boneAt(1, "head") === undefined,
  );
  const at3 = frameAt(late, 3);
  TestValidator.predicate(
    "past its envelope the locomotion keeps only its root",
    at3.pose.root !== null &&
      nclose(at3.pose.root.translation.x, 1) &&
      at3.pose.joints.every((j) => j.bone !== "leftUpperLeg"),
  );
  TestValidator.predicate(
    "the late lookAt plays inside its own span",
    nclose(boneAt(4, "head")!.flexion!, 60),
  );

  // 3. a finished flinch's explicit-zero rest releases its joint claims: the
  //    bow's spine is NOT diluted toward zero after the react's envelope ends
  const react: IAutoMovieActionCall = {
    verb: "react",
    from: { kind: "node", node: "x" },
    force: 0.5,
    actor: "hero",
    start: 0,
    duration: 1,
  };
  const lateBow: IAutoMovieActionCall = {
    verb: "gesture",
    kind: "bow",
    region: "upperBody",
    actor: "hero",
    start: 1.5,
    duration: "auto",
  };
  const undiluted = compilePerformance([react, lateBow], synth).hero!;
  const bowEnd = frameAt(undiluted, 2.5).pose.joints.find(
    (j) => j.bone === "leftUpperArm",
  );
  const spineAfter = frameAt(undiluted, 2.5).pose.joints.find(
    (j) => j.bone === "spine",
  );
  TestValidator.predicate(
    "a finished react stops claiming its explicit-zero joints",
    bowEnd !== undefined &&
      nclose(bowEnd.flexion!, 20) &&
      spineAfter === undefined,
  );

  // 4. a late-starting composite holds rest until its authored start (the
  //    `step` lead-in pad), instead of clamping the first pose backward
  const padded = compilePerformance([lateLook], synth).hero!;
  TestValidator.predicate(
    "a late composite pads a step rest keyframe at t=0",
    padded.keyframes[0]!.time === 0 &&
      padded.keyframes[0]!.easing === "step" &&
      padded.keyframes[0]!.pose.joints.length === 0 &&
      nclose(padded.keyframes[1]!.time, 3),
  );
};
