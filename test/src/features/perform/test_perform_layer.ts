import {
  IAutoMovieActionSynthesizer,
  compilePerformance,
  sampleMotion,
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

// the real lookAt synthesizer's FIRST keyframe is already the full aim
// (makeActorSynthesizer), which is exactly what makes a backward envelope
// leak visible — mirror that shape here (#1060)
const aimClip = (): IAutoMovieMotion =>
  makeMotion(
    [
      keyframe(0, makePose([joint("head", { flexion: 60 })])),
      keyframe(1, makePose([joint("head", { flexion: 60 })])),
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
  if (action.verb === "lookAt") return aimClip();
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
 * 4. A late-starting composite pads rest keyframes from t=0 up to its authored
 *    start, so shot sampling holds rest instead of clamping the first pose
 *    backward.
 * 5. The envelope holds BETWEEN union keyframes (#1060): an off-grid sample claims
 *    neither a late lookAt's aim nor a finished locomote's joints, while the
 *    walk's destination root still persists; a late emote's expression stays
 *    null before its start on both the layered and the padded path.
 * 6. An inserted boundary time where no clip contributes (two rootless clips with
 *    a gap between their spans) compiles and samples as honest rest.
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
  //    `step` lead-in pad plus its `first − ε` twin, #1060), instead of
  //    clamping the first pose backward
  const padded = compilePerformance([lateLook], synth).hero!;
  TestValidator.predicate(
    "a late composite pads rest keyframes up to its authored start",
    padded.keyframes[0]!.time === 0 &&
      padded.keyframes[0]!.easing === "step" &&
      padded.keyframes[0]!.pose.joints.length === 0 &&
      padded.keyframes[1]!.time < 3 &&
      padded.keyframes[1]!.pose.joints.length === 0 &&
      padded.keyframes[1]!.expression === null &&
      nclose(padded.keyframes[2]!.time, 3),
  );

  // 5. the envelope holds BETWEEN union keyframes too (#1060): off-grid
  //    samples must not ramp a late clip's content backward, nor keep a
  //    finished clip's joints melting toward zero
  const offGrid = sampleMotion(late, 2);
  TestValidator.predicate(
    "off-grid: a late lookAt claims nothing mid-segment",
    offGrid.pose.joints.every((j) => j.bone !== "head"),
  );
  TestValidator.predicate(
    "off-grid: a finished locomote releases its joints mid-segment",
    offGrid.pose.joints.every((j) => j.bone !== "leftUpperLeg"),
  );
  TestValidator.predicate(
    "off-grid: the walk's destination root still persists",
    offGrid.pose.root !== null && nclose(offGrid.pose.root.translation.x, 1),
  );

  const lateEmote: IAutoMovieActionCall = {
    verb: "emote",
    preset: "happy",
    intensity: 0.8,
    actor: "hero",
    start: 3,
    duration: 1,
  };
  const layeredEmote = compilePerformance([locomote, lateEmote], synth).hero!;
  TestValidator.predicate(
    "off-grid: a layered late emote's expression stays null before its start",
    sampleMotion(layeredEmote, 0.1).expression === null &&
      sampleMotion(layeredEmote, 2).expression === null &&
      sampleMotion(layeredEmote, 3.5).expression?.preset === "happy",
  );
  const paddedEmote = compilePerformance([lateEmote], synth).hero!;
  TestValidator.predicate(
    "the lead-in pad holds a null expression until the authored start",
    sampleMotion(paddedEmote, 0.5).expression === null &&
      sampleMotion(paddedEmote, 3.5).expression?.preset === "happy",
  );

  // a start inside the boundary width (0 < first ≤ ε) gets only the t=0 pad:
  // a `first − ε` twin would land at or before 0 and break the strictly
  // increasing keyframe contract
  const hairline = compilePerformance(
    [{ ...lateEmote, start: 5e-7 }],
    synth,
  ).hero!;
  TestValidator.predicate(
    "a hairline start pads t=0 only, keeping times strictly increasing",
    hairline.keyframes[0]!.time === 0 &&
      nclose(hairline.keyframes[1]!.time, 5e-7) &&
      hairline.keyframes.every(
        (k, i, all) => i === 0 || k.time > all[i - 1]!.time,
      ),
  );

  // 6. an inserted boundary time where NO clip contributes is honestly rest:
  //    two rootless clips with a gap between their spans (a finished flinch,
  //    a not-yet-started lookAt) compile and sample as rest in the gap
  const gapLook = compilePerformance([react, lateLook], synth).hero!;
  const gap = sampleMotion(gapLook, 2);
  TestValidator.predicate(
    "a fully-released gap samples as rest",
    gap.pose.joints.length === 0 &&
      gap.pose.root === null &&
      gap.expression === null,
  );
};
