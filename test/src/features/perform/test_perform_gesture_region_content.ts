import {
  IAutoMovieActionSynthesizer,
  compilePerformance,
  gestureMotion,
} from "@automovie/engine";
import {
  AutoMovieGestureKind,
  IAutoMovieActionCall,
  IAutoMovieMotion,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/** Real engine gesture content; a simple face clip for emote; null otherwise. */
const synth: IAutoMovieActionSynthesizer = (
  action: IAutoMovieActionCall,
): IAutoMovieMotion | null => {
  if (action.verb === "gesture")
    return gestureMotion(`hero:${action.kind}`, "skeleton-1", action.kind, 1);
  if (action.verb === "emote")
    return makeMotion(
      [
        keyframe(0, makePose([]), "linear", {
          preset: "happy",
          intensity: 1,
          blendshapes: null,
        }),
        keyframe(1, makePose([]), "linear", {
          preset: "happy",
          intensity: 1,
          blendshapes: null,
        }),
      ],
      1,
    );
  return null;
};

const gesture = (
  kind: AutoMovieGestureKind,
  region?: IAutoMovieActionCall["region"],
): IAutoMovieActionCall => ({
  verb: "gesture",
  kind,
  actor: "hero",
  start: 0,
  duration: 1,
  ...(region === undefined ? {} : { region }),
});

const jointsAt = (motion: IAutoMovieMotion, time: number) => {
  const frame = motion.keyframes.find((k) => nclose(k.time, time));
  if (frame === undefined) throw new Error(`no keyframe at ${time}`);
  return {
    frame,
    map: new Map(frame.pose.joints.map((j) => [j.bone, j])),
  };
};

/**
 * The engine's own gesture content must survive `compilePerformance`'s region
 * masking: per-kind default regions (nod/shake → head, whole-body kinds →
 * fullBody) keep every authored joint, where the old blanket `upperBody`
 * default silently stripped head, leg, and root channels.
 *
 * Scenarios:
 *
 * 1. A lone `nod` compiles to a clip that still drives the head (flexion 22 at the
 *    0.25 stop); under the old default it compiled to empty poses.
 * 2. A lone `crouch` keeps its knee bend (lowerLeg flexion 65 at the 0.3 stop)
 *    alongside the spine lean; legs previously vanished.
 * 3. A lone `kick` keeps both the right-leg snap (upperLeg 55 at 0.22) and the
 *    spine counterbalance (−6): fullBody spans what upperBody stripped.
 * 4. A `jump` layered with a concurrent `emote` (face, disjoint) keeps its
 *    ballistic root at the apex stop (y 0.34 at 0.58): fullBody is a root
 *    region, so layering no longer drops the leap.
 * 5. A `nod` layered with a `wave` (head + upperBody, disjoint under the new
 *    defaults) drives the head and the waving arm at the same instant.
 * 6. An explicit narrower `region` still masks: a kick forced to `upperBody` keeps
 *    the spine but drops the leg: the documented escape hatch and the
 *    cross-region leak strip stay intact.
 */
export const test_perform_gesture_region_content = (): void => {
  const nod = compilePerformance([gesture("nod")], synth).performances.hero!;
  const nodStop = jointsAt(nod, 0.25);
  TestValidator.predicate(
    "a lone nod still drives the head",
    nclose(nodStop.map.get("head")!.flexion!, 22),
  );

  const crouch = compilePerformance([gesture("crouch")], synth).performances
    .hero!;
  const crouchStop = jointsAt(crouch, 0.3);
  TestValidator.predicate(
    "a lone crouch keeps its knee bend and spine lean",
    nclose(crouchStop.map.get("leftLowerLeg")!.flexion!, 65) &&
      nclose(crouchStop.map.get("rightLowerLeg")!.flexion!, 65) &&
      nclose(crouchStop.map.get("spine")!.flexion!, 15),
  );

  const kick = compilePerformance([gesture("kick")], synth).performances.hero!;
  const kickStop = jointsAt(kick, 0.22);
  TestValidator.predicate(
    "a lone kick keeps the leg snap and the spine counterbalance",
    nclose(kickStop.map.get("rightUpperLeg")!.flexion!, 55) &&
      nclose(kickStop.map.get("rightLowerLeg")!.flexion!, 75) &&
      nclose(kickStop.map.get("spine")!.flexion!, -6),
  );

  const emote: IAutoMovieActionCall = {
    verb: "emote",
    preset: "happy",
    intensity: 1,
    actor: "hero",
    start: 0,
    duration: 1,
  };
  const jump = compilePerformance([gesture("jump"), emote], synth).performances
    .hero!;
  const apex = jointsAt(jump, 0.58);
  TestValidator.predicate(
    "a layered jump keeps its ballistic root at the apex",
    apex.frame.pose.root !== null &&
      nclose(apex.frame.pose.root.translation.y, 0.34),
  );

  const nodAndWave = compilePerformance(
    [gesture("nod"), gesture("wave")],
    synth,
  ).performances.hero!;
  const both = jointsAt(nodAndWave, 0.25);
  TestValidator.predicate(
    "a nod and a wave layer on disjoint regions",
    both.map.has("head") && both.map.has("rightUpperArm"),
  );

  const maskedKick = compilePerformance([gesture("kick", "upperBody")], synth)
    .performances.hero!;
  const maskedStop = jointsAt(maskedKick, 0.22);
  TestValidator.predicate(
    "an explicit narrower region still masks the clip to its bones",
    maskedStop.map.has("spine") && !maskedStop.map.has("rightUpperLeg"),
  );
};
