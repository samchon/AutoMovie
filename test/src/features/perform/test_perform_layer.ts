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
  return null;
};

const frameAt = (motion: IAutoMovieMotion, time: number) =>
  motion.keyframes.find((k) => nclose(k.time, time))!;

/**
 * `compilePerformance` layering — actions on disjoint body regions play
 * concurrently rather than taking turns.
 *
 * Scenario: a `locomote` (lowerBody), a `gesture` (upperBody, region set
 * explicitly), and an `emote` (face) all start at 0. They occupy three disjoint
 * regions, so the actor's performance layers them: at t=1 the merged pose
 * drives both the leg and the arm, and the face's expression rides along. The
 * fake synthesizer deliberately leaks cross-region joints and a gesture root;
 * the compiler strips those before layering.
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
};
