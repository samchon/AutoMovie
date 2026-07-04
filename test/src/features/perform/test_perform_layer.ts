import {
  IautomovieActionSynthesizer,
  compilePerformance,
} from "@automovie/engine";
import {
  automovieHumanoidBone,
  IautomovieActionCall,
  IautomovieExpression,
  IautomovieMotion,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const HAPPY: IautomovieExpression = {
  preset: "happy",
  intensity: 0.8,
  blendshapes: null,
};

const jointClip = (bone: automovieHumanoidBone): IautomovieMotion =>
  makeMotion(
    [
      keyframe(0, makePose([joint(bone, { flexion: 0 })])),
      keyframe(1, makePose([joint(bone, { flexion: 30 })])),
    ],
    1,
  );

const emoteClip = (): IautomovieMotion =>
  makeMotion(
    [
      keyframe(0, makePose([]), "linear", HAPPY),
      keyframe(1, makePose([]), "linear", HAPPY),
    ],
    1,
  );

/** A region-appropriate clip per verb; null for anything else. */
const synth: IautomovieActionSynthesizer = (
  action: IautomovieActionCall,
): IautomovieMotion | null => {
  if (action.verb === "locomote") return jointClip("leftUpperLeg");
  if (action.verb === "gesture") return jointClip("leftUpperArm");
  if (action.verb === "emote") return emoteClip();
  return null;
};

const frameAt = (motion: IautomovieMotion, time: number) =>
  motion.keyframes.find((k) => nclose(k.time, time))!;

/**
 * `compilePerformance` layering ??actions on disjoint body regions play
 * concurrently rather than taking turns.
 *
 * Scenario: a `locomote` (lowerBody), a `gesture` (upperBody, region set
 * explicitly), and an `emote` (face) all start at 0. They occupy three disjoint
 * regions, so the actor's performance layers them: at t=1 the merged pose
 * drives both the leg and the arm, and the face's expression rides along.
 */
export const test_perform_layer = (): void => {
  const locomote: IautomovieActionCall = {
    verb: "locomote",
    gait: "walk",
    to: { kind: "node", node: "x" },
    actor: "hero",
    start: 0,
    duration: "auto",
  };
  const gesture: IautomovieActionCall = {
    verb: "gesture",
    kind: "wave",
    region: "upperBody",
    actor: "hero",
    start: 0,
    duration: "auto",
  };
  const emote: IautomovieActionCall = {
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
  const bones = end.pose.joints.map((j) => j.bone);
  TestValidator.predicate(
    "the leg and the arm are driven at the same instant",
    bones.includes("leftUpperLeg") && bones.includes("leftUpperArm"),
  );
  TestValidator.predicate(
    "the face's expression rides along",
    end.expression !== null && end.expression.preset === "happy",
  );
};
